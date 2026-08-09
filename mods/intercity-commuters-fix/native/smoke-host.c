#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct lua_State lua_State;
typedef lua_State *(__cdecl *luaL_newstate_fn)(void);
typedef int (__cdecl *luaL_loadstring_fn)(lua_State *, const char *);
typedef int (__cdecl *lua_pcall_fn)(lua_State *, int, int, int);
typedef void (__cdecl *lua_getfield_fn)(lua_State *, int, const char *);
typedef void (__cdecl *lua_settop_fn)(lua_State *, int);
typedef int (__cdecl *lua_toboolean_fn)(lua_State *, int);
typedef const char *(__cdecl *lua_tolstring_fn)(lua_State *, int, size_t *);
typedef void (__cdecl *lua_close_fn)(lua_State *);
typedef int (__cdecl *luaopen_observer_fn)(lua_State *);

static FARPROC required(HMODULE module, const char *name) {
  FARPROC result = GetProcAddress(module, name);
  if (!result) fprintf(stderr, "Missing export: %s\n", name);
  return result;
}

#define RESOLVE(target, module, name) do { \
  FARPROC address = required((module), (name)); \
  if (!address) return 2; \
  memcpy(&(target), &address, sizeof(target)); \
} while (0)

static char *read_source(const char *path) {
  FILE *source = fopen(path, "rb");
  long length;
  char *contents;
  size_t read_length;
  if (!source) return NULL;
  if (fseek(source, 0, SEEK_END) != 0 || (length = ftell(source)) < 0 || fseek(source, 0, SEEK_SET) != 0) {
    fclose(source);
    return NULL;
  }
  contents = (char *)malloc((size_t)length + 1);
  if (!contents) {
    fclose(source);
    return NULL;
  }
  read_length = fread(contents, 1, (size_t)length, source);
  fclose(source);
  if (read_length != (size_t)length) {
    free(contents);
    return NULL;
  }
  contents[read_length] = '\0';
  return contents;
}

int main(int argc, char **argv) {
  HMODULE lua_module = LoadLibraryA("LuaPlus_1100.dll");
  HMODULE observer_module;
  luaL_newstate_fn newstate;
  luaL_loadstring_fn loadstring;
  lua_pcall_fn pcall;
  lua_getfield_fn getfield;
  lua_settop_fn settop;
  lua_toboolean_fn toboolean;
  lua_tolstring_fn tolstring;
  lua_close_fn close_state;
  luaopen_observer_fn open_observer;
  lua_State *state;
  char *source = NULL;
  const char *value;

  setvbuf(stderr, NULL, _IONBF, 0);
  fprintf(stderr, "smoke: loading LuaPlus\n");

  if (!lua_module) {
    fprintf(stderr, "Could not load LuaPlus_1100.dll (%lu)\n", GetLastError());
    return 1;
  }
  fprintf(stderr, "smoke: loading observer DLL\n");
  observer_module = LoadLibraryA("cxxlcommuters.dll");
  if (!observer_module) {
    fprintf(stderr, "Could not load cxxlcommuters.dll (%lu)\n", GetLastError());
    return 1;
  }
  RESOLVE(newstate, lua_module, "luaL_newstate");
  RESOLVE(loadstring, lua_module, "luaL_loadstring");
  RESOLVE(pcall, lua_module, "lua_pcall");
  RESOLVE(getfield, lua_module, "lua_getfield");
  RESOLVE(settop, lua_module, "lua_settop");
  RESOLVE(toboolean, lua_module, "lua_toboolean");
  RESOLVE(tolstring, lua_module, "lua_tolstring");
  RESOLVE(close_state, lua_module, "lua_close");
  RESOLVE(open_observer, observer_module, "luaopen_cxxlcommuters");

  fprintf(stderr, "smoke: creating Lua state\n");
  state = newstate();
  if (!state) return 3;

  if (argc == 3 && strcmp(argv[1], "--syntax") == 0) {
    source = read_source(argv[2]);
    if (!source) {
      fprintf(stderr, "Could not read Lua source: %s\n", argv[2]);
      close_state(state);
      return 6;
    }
    if (loadstring(state, source) != 0) {
      const char *error = tolstring(state, -1, NULL);
      fprintf(stderr, "Lua syntax test failed: %s\n", error ? error : "unknown error");
      free(source);
      close_state(state);
      return 5;
    }
    free(source);
    close_state(state);
    puts("Cities XXL commuter Lua syntax test passed.");
    return 0;
  }

  fprintf(stderr, "smoke: opening observer module\n");
  if (open_observer(state) != 1) {
    fprintf(stderr, "Observer module returned no Lua table\n");
    close_state(state);
    return 4;
  }

  getfield(state, 1, "version");
  value = tolstring(state, -1, NULL);
  if (!value || strcmp(value, "0.1.0-observer") != 0) {
    fprintf(stderr, "Observer returned an unexpected version\n");
    close_state(state);
    return 5;
  }
  settop(state, 1);
  getfield(state, 1, "observer_only");
  if (!toboolean(state, -1)) {
    fprintf(stderr, "Observer did not declare observer-only mode\n");
    close_state(state);
    return 5;
  }
  settop(state, 1);
  getfield(state, 1, "hooks_installed");
  if (toboolean(state, -1)) {
    fprintf(stderr, "Observer unexpectedly declared hooks\n");
    close_state(state);
    return 5;
  }

  settop(state, 1);
  getfield(state, 1, "status");
  if (pcall(state, 0, 1, 0) != 0) {
    fprintf(stderr, "Observer status call failed\n");
    close_state(state);
    return 5;
  }
  getfield(state, 2, "phase");
  value = tolstring(state, -1, NULL);
  if (!value || strcmp(value, "idle") != 0) {
    fprintf(stderr, "Observer did not begin idle\n");
    close_state(state);
    return 5;
  }

  settop(state, 1);
  getfield(state, 1, "start");
  if (pcall(state, 0, 2, 0) != 0 || toboolean(state, 2)) {
    fprintf(stderr, "Observer did not fail closed in the smoke-host process\n");
    close_state(state);
    return 5;
  }
  value = tolstring(state, 3, NULL);
  if (!value || strstr(value, "CitiesXXL.exe") == NULL) {
    fprintf(stderr, "Observer returned an unexpected refusal: %s\n", value ? value : "nil");
    close_state(state);
    return 5;
  }

  settop(state, 1);
  getfield(state, 1, "status");
  if (pcall(state, 0, 1, 0) != 0) {
    fprintf(stderr, "Observer post-refusal status call failed\n");
    close_state(state);
    return 5;
  }
  getfield(state, 2, "phase");
  value = tolstring(state, -1, NULL);
  if (!value || strcmp(value, "failed") != 0) {
    fprintf(stderr, "Observer did not retain failed state\n");
    close_state(state);
    return 5;
  }

  fprintf(stderr, "smoke: closing Lua state\n");
  close_state(state);
  puts("Cities XXL commuter observer smoke test passed.");
  return 0;
}
