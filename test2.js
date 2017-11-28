const io = require("socket.io-client")

var player = io.connect("wss://biddingtictactoe.herokuapp.com/")

player.on("connect", function() {
    player.emit("join match", process.argv[process.argv.length - 1], "Andrea")
})

player.on("joined match", name => {
    console.log(name)
    player.emit("bid", 20)
})

player.on("bids received", bid => {
    console.log(bid)
    player.emit("check", 1, 1)
})

player.on("check received", console.log)
