"use strict"
const express = require("express")
const socketIO = require("socket.io")
const path = require("path")

const PORT = process.env.PORT || 3000
const INDEX = path.join(__dirname, "client", "index.html")

const server = express()
    .use(require("cors"))
    .use((req, res) => res.sendFile(INDEX))
    .listen(PORT, () => console.log(`Listening on ${PORT}`))

const io = socketIO(server)
io.set("origins", "*:*")

let games = {}

const winningPositions = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
]
function playerWhoChecked(board, position) {
    return board[position[0]][position[1]]
}
function checkVictory(board, player) {
    for (let i in winningPositions) {
        if (
            playerWhoChecked(board, winningPositions[i][0]) === player &&
            playerWhoChecked(board, winningPositions[i][1]) === player &&
            playerWhoChecked(board, winningPositions[i][2]) === player
        )
            return true
    }
    return false
}
function checkDraw(board) {
    for (let i in winningPositions) {
        const containsX =
            winning[i]
                .map(cell => playerWhoChecked(board, cell))
                .indexOf("X") !== -1

        const containsO =
            winning[i]
                .map(cell => playerWhoChecked(board, cell))
                .indexOf("O") !== -1

        if (!containsX || !containsO) return false // there still is one possible tris
    }

    return true
}

io.on("connection", function(socket) {
    socket.on("disconnect", function() {
        console.log("user disconnected")
    })

    socket.on("new game", function(name) {
        let gameRoom = Math.floor(Math.random() * 1000).toString()
        while (games.hasOwnProperty(gameRoom)) {
            gameRoom = Math.floor(Math.random() * 1000).toString()
        }
        games[gameRoom] = {
            playerO: {name, fiches: 100},
            board: [["", "", ""], ["", "", ""], ["", "", ""]],
            gameState: "bidding",
            evenBidStreak: 0,
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
        if (games[socket.game].gameState !== "bidding") {
            console.log("not time to bid")
            socket.emit("bid error", "it's not time to bid")
            return
        }

        let intBid
        try {
            intBid = parseInt(bid)
        } catch (e) {
            socket.emit("bid error", "that is not an integer")
            return
        }

        if (games[socket.game][`player${socket.player}`].fiches < intBid) {
            socket.emit("bid error", "you don't have that kind of money")
            return
        }
        games[socket.game]["bid" + socket.player] = intBid
        if (games[socket.game][socket.player === "O" ? "bidX" : "bidO"]) {
            // if other player has bidded too
            console.log("bids received")
            const bidO = games[socket.game].bidO,
                bidX = games[socket.game].bidX

            if (bidO > bidX) {
                games[socket.game].playerO.fiches -= bidO
                games[socket.game].playerX.fiches += bidO
                games[socket.game].playing = "O"

                io.in(socket.game).emit("bids received", {
                    playing: "O",
                    bidO,
                    bidX,
                    newXFiches: games[socket.game].playerX.fiches,
                    newOFiches: games[socket.game].playerO.fiches,
                })
                games[socket.game]["bidX"] = null
                games[socket.game]["bidO"] = null
                games[socket.game].gameState = "checking"
            } else if (bidX > bidO) {
                games[socket.game].playerX.fiches -= bidX
                games[socket.game].playerO.fiches += bidX
                games[socket.game].playing = "X"

                io.in(socket.game).emit("bids received", {
                    playing: "X",
                    bidO,
                    bidX,
                    newXFiches: games[socket.game].playerX.fiches,
                    newOFiches: games[socket.game].playerO.fiches,
                })
                games[socket.game]["bidX"] = null
                games[socket.game]["bidO"] = null
                games[socket.game].gameState = "checking"
            } else {
                games[socket.game]["bidX"] = null
                games[socket.game]["bidO"] = null
                games[socket.game].evenBidStreak += 1
                if (games[socket.game].evenBidStreak > 4) {
                    io.in(socket.game).emit("game ended", "bidDraw")
                } else {
                    io.in(socket.game).emit("bids even")
                }
            }
        }
    })

    socket.on("check", function(row, col) {
        if (
            games[socket.game].playing === socket.player &&
            games[socket.game].gameState === "checking"
        ) {
            if (!games[socket.game].board[row][col]) {
                games[socket.game].playing = null
                games[socket.game].board[row][col] = socket.player
                io
                    .in(socket.game)
                    .emit("check received", row, col, socket.player)

                if (checkVictory(games[socket.game].board, "X")) {
                    io.in(socket.game).emit("game ended", "X")
                } else if (checkVictory(games[socket.game].board, "O")) {
                    io.in(socket.game).emit("game ended", "O")
                } else if (checkDraw(board)) {
                    io.in(socket.game).emit("game ended", "boardDraw")
                } else {
                    games[socket.game].gameState = "bidding"
                }
            } else {
                socket.emit("check error", "position already checked")
            }
        } else {
            socket.emit("check error", "you are not allowed to play now")
        }
    })
})
