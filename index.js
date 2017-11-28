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

let matches = {}

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
            winningPositions[i]
                .map(cell => playerWhoChecked(board, cell))
                .indexOf("X") !== -1

        const containsO =
            winningPositions[i]
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

    socket.on("new match", function(name, gamesLeft) {
        let matchRoom = Math.floor(Math.random() * 1000).toString()
        while (matches.hasOwnProperty(matchRoom)) {
            matchRoom = Math.floor(Math.random() * 1000).toString()
        }
        matches[matchRoom] = {
            playerO: {name, fiches: 100},
            board: [["", "", ""], ["", "", ""], ["", "", ""]],
            gameState: "bidding",
            evenBidStreak: 0,
            gamesLeft: gamesLeft,
        }
        socket.match = matchRoom
        socket.player = "O"

        socket.join(matchRoom)
        socket.emit("created match", matchRoom)
    })
    socket.on("join match", function(matchRoom, name) {
        if (matches.hasOwnProperty(matchRoom)) {
            matches[matchRoom].playerX = {name, fiches: 100}
            socket.join(matchRoom)
            socket.match = matchRoom
            socket.player = "X"

            socket.emit("joined match", matches[matchRoom].playerO.name)
            socket.to(matchRoom).emit("player found", name)
        } else {
            socket.emit("join match error", "match does not exist")
        }
    })

    socket.on("bid", function(bid) {
        if (matches[socket.match].gameState !== "bidding") {
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

        if (matches[socket.match][`player${socket.player}`].fiches < intBid) {
            socket.emit("bid error", "you don't have that kind of money")
            return
        }
        matches[socket.match]["bid" + socket.player] = intBid
        if (
            matches[socket.match][socket.player === "O" ? "bidX" : "bidO"] !==
                null &&
            matches[socket.match][socket.player === "O" ? "bidX" : "bidO"] !==
                undefined
        ) {
            // if other player has bidded too
            console.log("bids received")
            const bidO = matches[socket.match].bidO,
                bidX = matches[socket.match].bidX

            if (bidO > bidX) {
                matches[socket.match].playerO.fiches -= bidO
                matches[socket.match].playerX.fiches += bidO
                matches[socket.match].playing = "O"

                io.in(socket.match).emit("bids received", {
                    playing: "O",
                    bidO,
                    bidX,
                    newXFiches: matches[socket.match].playerX.fiches,
                    newOFiches: matches[socket.match].playerO.fiches,
                })
                matches[socket.match]["bidX"] = null
                matches[socket.match]["bidO"] = null
                matches[socket.match].gameState = "checking"
            } else if (bidX > bidO) {
                matches[socket.match].playerX.fiches -= bidX
                matches[socket.match].playerO.fiches += bidX
                matches[socket.match].playing = "X"

                io.in(socket.match).emit("bids received", {
                    playing: "X",
                    bidO,
                    bidX,
                    newXFiches: matches[socket.match].playerX.fiches,
                    newOFiches: matches[socket.match].playerO.fiches,
                })
                matches[socket.match]["bidX"] = null
                matches[socket.match]["bidO"] = null
                matches[socket.match].gameState = "checking"
            } else {
                matches[socket.match]["bidX"] = null
                matches[socket.match]["bidO"] = null
                matches[socket.match].evenBidStreak += 1
                if (matches[socket.match].evenBidStreak > 4) {
                    io.in(socket.match).emit("game ended", "bidDraw")
                } else {
                    io.in(socket.match).emit("bids even")
                }
            }
        }
    })

    socket.on("check", function(row, col) {
        if (
            matches[socket.match].playing === socket.player &&
            matches[socket.match].gameState === "checking"
        ) {
            if (!matches[socket.match].board[row][col]) {
                matches[socket.match].playing = null
                matches[socket.match].board[row][col] = socket.player
                io
                    .in(socket.match)
                    .emit("check received", row, col, socket.player)

                if (checkVictory(matches[socket.match].board, "X")) {
                    io.in(socket.match).emit("game ended", "X")
                } else if (checkVictory(matches[socket.match].board, "O")) {
                    io.in(socket.match).emit("game ended", "O")
                } else if (checkDraw(matches[socket.match].board)) {
                    io.in(socket.match).emit("game ended", "boardDraw")
                } else {
                    matches[socket.match].gameState = "bidding"
                }
            } else {
                socket.emit("check error", "position already checked")
            }
        } else {
            socket.emit("check error", "you are not allowed to play now")
        }
    })
})
