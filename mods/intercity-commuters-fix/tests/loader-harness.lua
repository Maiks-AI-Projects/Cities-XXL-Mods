local infoLogs = {}
local errorLogs = {}
LOG_INFO = function(message) table.insert(infoLogs, message) end
LOG_ERROR = function(message) table.insert(errorLogs, message) end

local pollCount = 0
local native = {
	observer_only = true,
	hooks_installed = false,
	start = function() return true, "verifying CitiesXXL.exe" end,
	poll = function(bytes)
		assert(bytes == 524288)
		pollCount = pollCount + 1
		if (pollCount == 1) then return { phase = "hashing_executable" } end
		return { phase = "verified", message = "verified" }
	end
}

package.loadlib = function(path, symbol)
	assert(path == "cxxlcommuters.dll")
	assert(symbol == "luaopen_cxxlcommuters")
	return function() return native end
end

MapSaveMgr = { originalCalls = 0 }
function MapSaveMgr:DoSave(value)
	self.originalCalls = self.originalCalls + 1
	return value + 1
end

dofile("../lua/mapsavemgr.master")
assert(MapSaveMgr:DoSave(40) == 41)
assert(MapSaveMgr:DoSave(41) == 42)
assert(MapSaveMgr.originalCalls == 2)
assert(pollCount == 2)
assert(#errorLogs == 0)
assert(#infoLogs == 2)
assert(CXXLCOMMUTERS.TerminalStatusLogged == true)

-- Loading the extension twice must not wrap MapSaveMgr twice or restart native loading.
dofile("../lua/mapsavemgr.master")
assert(MapSaveMgr:DoSave(42) == 43)
assert(MapSaveMgr.originalCalls == 3)
assert(pollCount == 3)
