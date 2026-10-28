local millennium = require("millennium")
local fs         = require("fs")
local http       = require("http")
local json       = require("json")
local utils      = require("utils")
local logger     = require("logger")

local dir   = fs.join(millennium.get_install_path(), "steam-playtime-dashboard")
local files = { state = "state.json", log = "sessions.jsonl", legacy = "playtime.json" }

local function store_path(name)
    local file = files[name]
    if not file then error("unknown store file: " .. tostring(name)) end
    return fs.join(dir, file)
end

local function read(path)
    if not fs.exists(path) then return "" end
    local content, err = utils.read_file(path)
    if not content then error("read failed: " .. tostring(err)) end
    return content
end

local function write(path, content)
    local tmp = path .. ".tmp"
    local ok, err = utils.write_file(tmp, content)
    if ok then ok, err = fs.rename(tmp, path) end
    if not ok then logger:error("write failed: " .. path .. ": " .. tostring(err)) end
    return ok == true
end

---@ffi
---@param name string
---@return string
function read_store(name)
    return read(store_path(name))
end

---@ffi
---@param name string
---@param content string
---@return boolean
function write_store(name, content)
    fs.create_directories(dir)
    return write(store_path(name), content)
end

---@ffi
---@param content string
---@return boolean
function append_log(content)
    fs.create_directories(dir)
    local ok, err = utils.append_file(store_path("log"), content)
    if not ok then logger:error("append failed: " .. tostring(err)) end
    return ok == true
end

---@ffi
---@return boolean
function retire_legacy()
    local path = store_path("legacy")
    local ok, err = fs.rename(path, path .. ".bak")
    if not ok then logger:error("retire failed: " .. tostring(err)) end
    return ok == true
end

---@ffi
---@param dest_dir string
---@param name string
---@return string
function export_log(dest_dir, name)
    local dest = fs.join(dest_dir, name)
    return write(dest, read(store_path("log"))) and dest or ""
end

---@ffi
---@param dest_dir string
---@param name string
---@param base64 string
---@return string
function save_image(dest_dir, name, base64)
    local dest = fs.join(dest_dir, name)
    return write(dest, utils.base64_decode(base64)) and dest or ""
end

---@ffi
---@param path string
---@return string
function read_import(path)
    return read(path)
end

---@ffi
---@param message string
---@return boolean
function log_error(message)
    logger:error(message)
    return true
end

---@ffi
---@param app_id number
---@return string
function fetch_genre(app_id)
    local id = tostring(math.floor(app_id))
    local res = http.get("https://store.steampowered.com/api/appdetails?filters=genres&l=english&appids=" .. id, { timeout = 15 })
    if not res or res.status ~= 200 then return "" end
    local ok, genre = pcall(function()
        local entry = json.decode(res.body)[id]
        if entry.success ~= true then return "Unknown" end
        local genres = type(entry.data) == "table" and entry.data.genres
        return type(genres) == "table" and genres[1] and genres[1].description or "Unknown"
    end)
    return ok and genre or ""
end
