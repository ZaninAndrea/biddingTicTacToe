const io = require("socket.io-client")

var player = io.connect("wss://biddingtictactoe.herokuapp.com/")

player.on("connect", function() {
    console.log("connected")
    player.emit("new match", "Giorgio")
})

player.on("created match", console.log)
player.on("player found", name => {
    console.log(name)
    player.emit("bid", 10)
})

player.on("bids received", bid => {
    console.log(bid)
})
player.on("check received", console.log)
