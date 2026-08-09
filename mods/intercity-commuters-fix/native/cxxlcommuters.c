#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <bcrypt.h>

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <wchar.h>

#define OBSERVER_VERSION "0.1.0-observer"
#define DEFAULT_POLL_BYTES (512u * 1024u)
#define MIN_POLL_BYTES (16u * 1024u)
#define MAX_POLL_BYTES (4u * 1024u * 1024u)

#define EXPECTED_EXE_SHA256 "fe80c2974dd71c488c7da7037466b1756e6e2e6be5d5d6727c23ac8f1ed760f4"
#define EXPECTED_DATA_SHA256 "aadac92c0e2e8dd8649066b21a1a9af18f4639332b54d227faeb1991894bf8f4"

typedef struct lua_State lua_State;
typedef int (__cdecl *lua_CFunction)(lua_State *state);

typedef void (__cdecl *lua_createtable_fn)(lua_State *, int, int);
typedef int (__cdecl *lua_gettop_fn)(lua_State *);
typedef void (__cdecl *lua_pushboolean_fn)(lua_State *, int);
typedef void (__cdecl *lua_pushcclosure_fn)(lua_State *, lua_CFunction, int);
typedef void (__cdecl *lua_pushinteger_fn)(lua_State *, ptrdiff_t);
typedef void (__cdecl *lua_pushstring_fn)(lua_State *, const char *);
typedef void (__cdecl *lua_setfield_fn)(lua_State *, int, const char *);
typedef ptrdiff_t (__cdecl *lua_tointeger_fn)(lua_State *, int);

static lua_createtable_fn api_createtable;
static lua_gettop_fn api_gettop;
static lua_pushboolean_fn api_pushboolean;
static lua_pushcclosure_fn api_pushcclosure;
static lua_pushinteger_fn api_pushinteger;
static lua_pushstring_fn api_pushstring;
static lua_setfield_fn api_setfield;
static lua_tointeger_fn api_tointeger;

typedef enum verification_phase {
  PHASE_IDLE,
  PHASE_HASHING_EXE,
  PHASE_HASHING_DATA,
  PHASE_VERIFIED,
  PHASE_FAILED,
  PHASE_STOPPED
} verification_phase;

typedef struct hash_job {
  HANDLE file;
  BCRYPT_ALG_HANDLE algorithm;
  BCRYPT_HASH_HANDLE hash;
  PUCHAR hash_object;
  ULONG hash_object_length;
  ULONG digest_length;
  uint64_t processed;
  uint64_t total;
} hash_job;

typedef struct observer_state {
  verification_phase phase;
  hash_job job;
  wchar_t executable_path[MAX_PATH];
  wchar_t data_path[MAX_PATH];
  char executable_hash[65];
  char data_hash[65];
  char message[256];
} observer_state;

static observer_state observer = {
  PHASE_IDLE,
  { INVALID_HANDLE_VALUE, NULL, NULL, NULL, 0, 0, 0, 0 },
  L"",
  L"",
  "",
  "",
  "observer is idle"
};

static const char *phase_name(verification_phase phase) {
  switch (phase) {
    case PHASE_IDLE: return "idle";
    case PHASE_HASHING_EXE: return "hashing_executable";
    case PHASE_HASHING_DATA: return "hashing_data_pak";
    case PHASE_VERIFIED: return "verified";
    case PHASE_FAILED: return "failed";
    case PHASE_STOPPED: return "stopped";
    default: return "unknown";
  }
}

static void copy_message(const char *message) {
  _snprintf(observer.message, sizeof(observer.message) - 1, "%s", message ? message : "unknown error");
  observer.message[sizeof(observer.message) - 1] = '\0';
}

static void close_hash_job(void) {
  if (observer.job.file != INVALID_HANDLE_VALUE) {
    CloseHandle(observer.job.file);
    observer.job.file = INVALID_HANDLE_VALUE;
  }
  if (observer.job.hash) {
    BCryptDestroyHash(observer.job.hash);
    observer.job.hash = NULL;
  }
  if (observer.job.algorithm) {
    BCryptCloseAlgorithmProvider(observer.job.algorithm, 0);
    observer.job.algorithm = NULL;
  }
  if (observer.job.hash_object) {
    HeapFree(GetProcessHeap(), 0, observer.job.hash_object);
    observer.job.hash_object = NULL;
  }
  observer.job.hash_object_length = 0;
  observer.job.digest_length = 0;
  observer.job.processed = 0;
  observer.job.total = 0;
}

static void fail_observer(const char *message) {
  close_hash_job();
  observer.phase = PHASE_FAILED;
  copy_message(message);
  OutputDebugStringA("Cities XXL Intercity Commuters observer refused: ");
  OutputDebugStringA(observer.message);
  OutputDebugStringA("\n");
}

static int nt_success(NTSTATUS status) {
  return status >= 0;
}

static int begin_hash(const wchar_t *path) {
  LARGE_INTEGER size;
  ULONG returned = 0;
  NTSTATUS status;

  close_hash_job();
  observer.job.file = CreateFileW(
    path,
    GENERIC_READ,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    NULL,
    OPEN_EXISTING,
    FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN,
    NULL
  );
  if (observer.job.file == INVALID_HANDLE_VALUE) return 0;
  if (!GetFileSizeEx(observer.job.file, &size) || size.QuadPart < 0) {
    close_hash_job();
    return 0;
  }
  observer.job.total = (uint64_t)size.QuadPart;

  status = BCryptOpenAlgorithmProvider(&observer.job.algorithm, BCRYPT_SHA256_ALGORITHM, NULL, 0);
  if (!nt_success(status)) {
    close_hash_job();
    return 0;
  }
  status = BCryptGetProperty(
    observer.job.algorithm,
    BCRYPT_OBJECT_LENGTH,
    (PUCHAR)&observer.job.hash_object_length,
    sizeof(observer.job.hash_object_length),
    &returned,
    0
  );
  if (!nt_success(status)) {
    close_hash_job();
    return 0;
  }
  status = BCryptGetProperty(
    observer.job.algorithm,
    BCRYPT_HASH_LENGTH,
    (PUCHAR)&observer.job.digest_length,
    sizeof(observer.job.digest_length),
    &returned,
    0
  );
  if (!nt_success(status) || observer.job.digest_length != 32) {
    close_hash_job();
    return 0;
  }
  observer.job.hash_object = (PUCHAR)HeapAlloc(
    GetProcessHeap(),
    HEAP_ZERO_MEMORY,
    observer.job.hash_object_length
  );
  if (!observer.job.hash_object) {
    close_hash_job();
    return 0;
  }
  status = BCryptCreateHash(
    observer.job.algorithm,
    &observer.job.hash,
    observer.job.hash_object,
    observer.job.hash_object_length,
    NULL,
    0,
    0
  );
  if (!nt_success(status)) {
    close_hash_job();
    return 0;
  }
  return 1;
}

static void digest_to_hex(const unsigned char *digest, char output[65]) {
  static const char alphabet[] = "0123456789abcdef";
  size_t index;
  for (index = 0; index < 32; index += 1) {
    output[index * 2] = alphabet[digest[index] >> 4];
    output[index * 2 + 1] = alphabet[digest[index] & 0x0f];
  }
  output[64] = '\0';
}

static int finish_current_hash(char output[65]) {
  unsigned char digest[32];
  NTSTATUS status = BCryptFinishHash(observer.job.hash, digest, sizeof(digest), 0);
  if (!nt_success(status)) return 0;
  digest_to_hex(digest, output);
  return 1;
}

static int executable_identity_is_supported(void) {
  HMODULE module = GetModuleHandleW(NULL);
  IMAGE_DOS_HEADER *dos;
  IMAGE_NT_HEADERS32 *nt;
  wchar_t *filename;
  DWORD length;

  if (sizeof(void *) != 4 || !module) {
    copy_message("observer requires a 32-bit process");
    return 0;
  }
  dos = (IMAGE_DOS_HEADER *)module;
  if (dos->e_magic != IMAGE_DOS_SIGNATURE || dos->e_lfanew <= 0) {
    copy_message("process image has an invalid DOS header");
    return 0;
  }
  nt = (IMAGE_NT_HEADERS32 *)((unsigned char *)module + dos->e_lfanew);
  if (
    nt->Signature != IMAGE_NT_SIGNATURE ||
    nt->FileHeader.Machine != IMAGE_FILE_MACHINE_I386 ||
    nt->OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR32_MAGIC
  ) {
    copy_message("process image is not the expected 32-bit PE format");
    return 0;
  }

  length = GetModuleFileNameW(NULL, observer.executable_path, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    copy_message("could not resolve the executable path");
    return 0;
  }
  filename = wcsrchr(observer.executable_path, L'\\');
  filename = filename ? filename + 1 : observer.executable_path;
  if (_wcsicmp(filename, L"CitiesXXL.exe") != 0) {
    copy_message("refusing a process other than CitiesXXL.exe");
    return 0;
  }
  return 1;
}

static int build_data_path(void) {
  wchar_t *separator;
  size_t prefix_length;
  static const wchar_t suffix[] = L"Paks\\data.pak";

  if (wcslen(observer.executable_path) >= MAX_PATH) return 0;
  wcscpy(observer.data_path, observer.executable_path);
  separator = wcsrchr(observer.data_path, L'\\');
  if (!separator) return 0;
  separator[1] = L'\0';
  prefix_length = wcslen(observer.data_path);
  if (prefix_length + wcslen(suffix) >= MAX_PATH) return 0;
  wcscat(observer.data_path, suffix);
  return 1;
}

static void complete_stage(void) {
  char *actual_hash;
  const char *expected_hash;
  verification_phase completed_phase = observer.phase;

  actual_hash = completed_phase == PHASE_HASHING_EXE ? observer.executable_hash : observer.data_hash;
  expected_hash = completed_phase == PHASE_HASHING_EXE ? EXPECTED_EXE_SHA256 : EXPECTED_DATA_SHA256;
  if (!finish_current_hash(actual_hash)) {
    fail_observer("SHA-256 finalization failed");
    return;
  }
  close_hash_job();
  if (strcmp(actual_hash, expected_hash) != 0) {
    fail_observer(completed_phase == PHASE_HASHING_EXE
      ? "CitiesXXL.exe SHA-256 does not match the verified 1.5.0 build"
      : "data.pak SHA-256 does not match the verified 1.5.0 build");
    return;
  }
  if (completed_phase == PHASE_HASHING_EXE) {
    if (!begin_hash(observer.data_path)) {
      fail_observer("could not open data.pak for read-only verification");
      return;
    }
    observer.phase = PHASE_HASHING_DATA;
    copy_message("verifying data.pak");
    return;
  }
  observer.phase = PHASE_VERIFIED;
  copy_message("verified Cities XXL 1.5.0; observer-only mode; no hooks installed");
  OutputDebugStringA("Cities XXL Intercity Commuters observer verified the supported build.\n");
}

static void poll_hash(uint32_t budget) {
  unsigned char buffer[64u * 1024u];

  while (
    budget > 0 &&
    (observer.phase == PHASE_HASHING_EXE || observer.phase == PHASE_HASHING_DATA)
  ) {
    DWORD requested = budget < sizeof(buffer) ? budget : (DWORD)sizeof(buffer);
    DWORD received = 0;
    NTSTATUS status;
    if (!ReadFile(observer.job.file, buffer, requested, &received, NULL)) {
      fail_observer("read failed during SHA-256 verification");
      return;
    }
    if (received == 0) {
      complete_stage();
      return;
    }
    status = BCryptHashData(observer.job.hash, buffer, received, 0);
    if (!nt_success(status)) {
      fail_observer("SHA-256 update failed");
      return;
    }
    observer.job.processed += received;
    budget -= received;
    if (observer.job.processed == observer.job.total) {
      complete_stage();
      return;
    }
  }
}

static void push_boolean_field(lua_State *state, const char *name, int value) {
  api_pushboolean(state, value);
  api_setfield(state, -2, name);
}

static void push_string_field(lua_State *state, const char *name, const char *value) {
  api_pushstring(state, value ? value : "");
  api_setfield(state, -2, name);
}

static void wide_to_utf8(const wchar_t *source, char *target, size_t target_length) {
  int result;
  if (!source || !source[0] || target_length == 0) {
    if (target_length > 0) target[0] = '\0';
    return;
  }
  result = WideCharToMultiByte(CP_UTF8, 0, source, -1, target, (int)target_length, NULL, NULL);
  if (result == 0) target[0] = '\0';
}

static void push_status(lua_State *state) {
  char processed[32];
  char total[32];
  char path_utf8[MAX_PATH * 3];

  api_createtable(state, 0, 13);
  push_string_field(state, "version", OBSERVER_VERSION);
  push_string_field(state, "phase", phase_name(observer.phase));
  push_boolean_field(state, "verified", observer.phase == PHASE_VERIFIED);
  push_boolean_field(state, "observer_only", 1);
  push_boolean_field(state, "hooks_installed", 0);
  push_string_field(state, "message", observer.message);
  _snprintf(processed, sizeof(processed), "%llu", (unsigned long long)observer.job.processed);
  _snprintf(total, sizeof(total), "%llu", (unsigned long long)observer.job.total);
  push_string_field(state, "processed_bytes", processed);
  push_string_field(state, "total_bytes", total);
  wide_to_utf8(observer.executable_path, path_utf8, sizeof(path_utf8));
  push_string_field(state, "executable_path", path_utf8);
  wide_to_utf8(observer.data_path, path_utf8, sizeof(path_utf8));
  push_string_field(state, "data_path", path_utf8);
  push_string_field(state, "executable_sha256", observer.executable_hash);
  push_string_field(state, "data_sha256", observer.data_hash);
}

static int observer_start(lua_State *state) {
  if (
    observer.phase == PHASE_HASHING_EXE ||
    observer.phase == PHASE_HASHING_DATA ||
    observer.phase == PHASE_VERIFIED
  ) {
    api_pushboolean(state, 1);
    api_pushstring(state, observer.message);
    return 2;
  }

  close_hash_job();
  memset(observer.executable_path, 0, sizeof(observer.executable_path));
  memset(observer.data_path, 0, sizeof(observer.data_path));
  observer.executable_hash[0] = '\0';
  observer.data_hash[0] = '\0';
  observer.phase = PHASE_IDLE;
  if (!executable_identity_is_supported()) {
    observer.phase = PHASE_FAILED;
    api_pushboolean(state, 0);
    api_pushstring(state, observer.message);
    return 2;
  }
  if (!build_data_path()) {
    fail_observer("could not construct the data.pak path");
    api_pushboolean(state, 0);
    api_pushstring(state, observer.message);
    return 2;
  }
  if (!begin_hash(observer.executable_path)) {
    fail_observer("could not open CitiesXXL.exe for read-only verification");
    api_pushboolean(state, 0);
    api_pushstring(state, observer.message);
    return 2;
  }
  observer.phase = PHASE_HASHING_EXE;
  copy_message("verifying CitiesXXL.exe");
  api_pushboolean(state, 1);
  api_pushstring(state, observer.message);
  return 2;
}

static int observer_poll(lua_State *state) {
  uint32_t budget = DEFAULT_POLL_BYTES;
  if (api_gettop(state) >= 1) {
    ptrdiff_t requested = api_tointeger(state, 1);
    if (requested >= (ptrdiff_t)MIN_POLL_BYTES && requested <= (ptrdiff_t)MAX_POLL_BYTES) {
      budget = (uint32_t)requested;
    }
  }
  if (observer.phase == PHASE_HASHING_EXE || observer.phase == PHASE_HASHING_DATA) {
    poll_hash(budget);
  }
  push_status(state);
  return 1;
}

static int observer_status(lua_State *state) {
  push_status(state);
  return 1;
}

static int observer_stop(lua_State *state) {
  (void)state;
  close_hash_job();
  observer.phase = PHASE_STOPPED;
  copy_message("observer stopped; no hooks were installed");
  return 0;
}

static int resolve_api(HMODULE module, const char *name, void *target, size_t target_size) {
  FARPROC address = GetProcAddress(module, name);
  if (!address || target_size != sizeof(address)) return 0;
  memcpy(target, &address, target_size);
  return 1;
}

static int resolve_lua_api(void) {
  HMODULE module = GetModuleHandleA("LuaPlus_1100.dll");
  if (!module) return 0;
  return
    resolve_api(module, "lua_createtable", &api_createtable, sizeof(api_createtable)) &&
    resolve_api(module, "lua_gettop", &api_gettop, sizeof(api_gettop)) &&
    resolve_api(module, "lua_pushboolean", &api_pushboolean, sizeof(api_pushboolean)) &&
    resolve_api(module, "lua_pushcclosure", &api_pushcclosure, sizeof(api_pushcclosure)) &&
    resolve_api(module, "lua_pushinteger", &api_pushinteger, sizeof(api_pushinteger)) &&
    resolve_api(module, "lua_pushstring", &api_pushstring, sizeof(api_pushstring)) &&
    resolve_api(module, "lua_setfield", &api_setfield, sizeof(api_setfield)) &&
    resolve_api(module, "lua_tointeger", &api_tointeger, sizeof(api_tointeger));
}

static void register_function(lua_State *state, const char *name, lua_CFunction function) {
  api_pushcclosure(state, function, 0);
  api_setfield(state, -2, name);
}

__declspec(dllexport) int __cdecl luaopen_cxxlcommuters(lua_State *state) {
  if (!resolve_lua_api()) return 0;
  api_createtable(state, 0, 7);
  register_function(state, "start", observer_start);
  register_function(state, "poll", observer_poll);
  register_function(state, "status", observer_status);
  register_function(state, "stop", observer_stop);
  api_pushstring(state, OBSERVER_VERSION);
  api_setfield(state, -2, "version");
  api_pushboolean(state, 1);
  api_setfield(state, -2, "observer_only");
  api_pushboolean(state, 0);
  api_setfield(state, -2, "hooks_installed");
  return 1;
}

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID reserved) {
  (void)instance;
  (void)reserved;
  if (reason == DLL_PROCESS_DETACH) close_hash_job();
  return TRUE;
}
