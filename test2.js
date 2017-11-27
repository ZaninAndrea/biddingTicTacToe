const io = require("socket.io-client")

var player = io.connect("ws://localhost/")

player.on("connect", function() {
    player.emit("join game", process.argv[process.argv.length - 1], "Andrea")
})

player.on("joined game", name => {
    console.log(name)
    player.emit("bid", 20)
})

player.on("bids received", bid => {
    console.log(bid)
    player.emit("check", 1, 1)
})

player.on("check received", console.log)
