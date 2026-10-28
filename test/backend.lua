local target, root = arg[1], arg[2]
os.execute("rm -rf " .. root .. " && mkdir -p " .. root)
local function exists(p) local f = io.open(p, "r"); if f then f:close() return true end return false end
package.preload.millennium = function() return { get_install_path = function() return root end } end
package.preload.fs = function() return {
    exists = exists,
    join = function(...) return table.concat({ ... }, "/") end,
    create_directories = function(p) os.execute("mkdir -p '" .. p .. "'") return true end,
    rename = function(a, b) local ok, err = os.rename(a, b) return ok, err end,
} end
package.preload.utils = function() return {
    read_file = function(p) local f = io.open(p, "rb"); if not f then return nil, "open failed" end local s = f:read("*a"); f:close(); return s end,
    write_file = function(p, c) local f = io.open(p, "wb"); if not f then return nil, "open failed" end f:write(c); f:close(); return true end,
    append_file = function(p, c) local f = io.open(p, "ab"); if not f then return nil, "open failed" end f:write(c); f:close(); return true end,
    base64_decode = function(s) return s == "aGk=" and "hi" or nil end,
} end
package.preload.http = function() return {} end
package.preload.json = function() return {} end
package.preload.logger = function() return { error = function(_, m) print("logger:error " .. m) end } end
dofile(target)
local dir = root .. "/steam-playtime-dashboard"
os.execute("mkdir -p " .. dir)
local f = io.open(dir .. "/playtime.json", "w"); f:write('{"sessions":[]}'); f:close()
assert(read_store("legacy") == '{"sessions":[]}', "read_store(legacy) did not return the file")
assert(read_store("log") == "", "missing log should read as empty")
assert(write_store("state", '{"v":2}') and read_store("state") == '{"v":2}', "state round-trip failed")
assert(append_log("a\n") and append_log("b\n") and read_store("log") == "a\nb\n", "append failed")
assert(export_log(root, "out.jsonl") == root .. "/out.jsonl" and read_import(root .. "/out.jsonl") == "a\nb\n", "export failed")
assert(save_image(root, "shot.png", "aGk=") == root .. "/shot.png" and read_import(root .. "/shot.png") == "hi", "save_image failed")
assert(retire_legacy() and not exists(dir .. "/playtime.json") and exists(dir .. "/playtime.json.bak"), "retire failed")
assert(not pcall(read_store, "nope"), "unknown name should error")
assert(log_error("boom") == true, "log_error failed")
print("BACKEND OK")
