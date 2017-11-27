const io = require("socket.io-client")

var player = io.connect("ws://localhost/")

player.on("connect", function() {
    player.emit("new game", "Giorgio")
})

player.on("created game", console.log)
player.on("player found", name => {
    console.log(name)
    player.emit("bid", 10)
})

player.on("bids received", bid => {
    console.log(bid)
})
player.on("check received", console.log)
