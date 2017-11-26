var io = require("socket.io")(80)
let games = {}

io.on("connection", function(socket) {
    socket.on("disconnect", function() {
        console.log("user disconnected")
    })

    socket.on("new game", function(name) {
        let gameRoom = Math.floor(Math.random() * 1000)
        while (games.hasOwnProperty(gameRoom)) {
            gameRoom = Math.floor(Math.random() * 1000)
        }
        games[gameRoom] = {
            playerO: {name, fiches: 100},
            board: [["", "", ""], ["", "", ""], ["", "", ""]],
        }
        socket.game = gameRoom
        socket.player = "O"

        socket.join(gameRoom)
        socket.emit("created game", gameRoom)
    })
    socket.on("join game", function(gameRoom, name) {
        if (games.hasOwnProperty(gameRoom)) {
            games[gameRoom].playerX = {name, fiches: 100}
            socket.join(gameRoom)
            socket.game = gameRoom
            socket.player = "X"

            socket.emit("joined game", games[gameRoom].playerO.name)
            socket.to(gameRoom).emit("player found", name)
        } else {
            socket.emit("join game error", "game does not exist")
        }
    })

    socket.on("bid", function(bid) {
        if (games[socket.game][`player${socket.player}`].fiches < bid) {
            socket.emit("bid error", "you don't have that kind of money")
            return
        }
        games[socket.game]["bid" + socket.player] = bid
        if (games[socket.game][socket.player === "O" ? "bidX" : "bidO"]) {
            // if other player has bidded too
            console.log("bids received")
            const bidO = games[socket.game].bidO,
                bidX = games[socket.game].bidX

            if (bidO > bidX) {
                games[socket.game].playerO.fiches -= bidO
                games[socket.game].playerX.fiches += bidO
                games[socket.game].playing = "O"

                io.in(socket.game).emit("bid received", {
                    playing: "O",
                    bidO,
                    bidX,
                    newXFiches: games[socket.game].playerX.fiches,
                    newOFiches: games[socket.game].playerO.fiches,
                })
                games[socket.game]["bidX"] = null
                games[socket.game]["bidO"] = null
            } else if (bidX > bidO) {
                games[socket.game].playerX.fiches -= bidX
                games[socket.game].playerO.fiches += bidX
                games[socket.game].playing = "X"

                io.in(socket.game).emit("bid received", {
                    playing: "X",
                    bidO,
                    bidX,
                    newXFiches: games[socket.game].playerX.fiches,
                    newOFiches: games[socket.game].playerO.fiches,
                })
                games[socket.game]["bidX"] = null
                games[socket.game]["bidO"] = null
            }
        }
    })

    socket.on("check", function(row, col) {
        if (games[socket.game].playing === socket.player) {
            if (!games[socket.game].board[row][col]) {
                games[socket.game].playing = null
                games[socket.game].board[row][col] = socket.player
                socket
                    .to(socket.game)
                    .emit("check received", row, col, socket.player)
            } else {
                socket.emit("check error", "position already checked")
            }
        } else {
            socket.emit("check error", "you are not allowed to play now")
        }
    })
})
