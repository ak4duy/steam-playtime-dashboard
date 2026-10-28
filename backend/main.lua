local millennium = require("millennium")
local logger     = require("logger")

require("rpc_functions")

local function on_load()
    logger:info("Playtime Dashboard loaded")
    millennium.ready()
end

return {
    on_load = on_load,
}
