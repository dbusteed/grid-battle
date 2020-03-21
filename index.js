const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

app.use(express.static('public'))

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html')
})

let players = {}
let lobby = []
let board = []
let game = false
let barriers = []

let to_remove = []

let LEVEL_UP_SPEED
let CAPTURE_SPEED

const playerSize = 30
const gameSize = 500

playerDefaults = [
	{
		name: "Red Ralph",
		color1: [196, 11, 11],
		color2: [221, 17, 17],
	},
	{ 
		name: "Blue Billy", 
		color1: [27, 48, 170],
		color2: [32, 184, 234],
	},
	{ 
		name: "Green Gary",
		color1: [65, 186, 40],
		color2: [66, 234, 32],
	},
	{
		name: "Purple Perry",
		color1: [137, 22, 175],
		color2: [190, 33, 242]
	},
]

emitUpdates = () => {
	if (game) {
		updateZones()
		
		io.emit('gameStateUpdate', { 
			players: players,
			board: board 
		})
	}
}

io.on('connection', socket => {
	console.log('user connected: ', socket.id)

	lobby.push(socket.id)
	io.emit('lobbyUpdate', lobby)

	// make a new board
	socket.on('newBoard', () => {

		if (game) {
			io.emit('gameOver')

			Object.keys(players).forEach(id => {
				if (to_remove.indexOf(id) == -1) {
					lobby.push(id)
				}
			})
	
			to_remove = []
	
			io.emit('lobbyUpdate', lobby)
		}

		game = false
		board = []
		barriers = []
		players = {}

		for(i=0; i<10; i++) {
			board[i] = []
			for(j=0; j<10; j++) {
				if(Math.floor(Math.random()*5) == 0) {
					board[i][j] = {
						owner: 'noone'
					}
					barriers.push({x: i, y: j})
				} else {
					board[i][j] = {
						owner: '',
						pct: 0
					}
				} 
			}
		}

		for(i=0; i<4; i++) {
			let guest = lobby[i]
			if (guest) {
				players[guest] = {
					id: guest,
					name: playerDefaults[i].name,
					color1: playerDefaults[i].color1,
					color2: playerDefaults[i].color2,
					armies: {},
					zones: 0,
				}								
			}
		}	

		Object.values(players).forEach(p => {

			// reset the armies
			p.armies = {}

			let count = 2
			while(count > 0) {
			
				for(i=0; i<10; i++) {
					for(j=0; j<10; j++) {
						if(board[i][j].owner == '') {
							if((Math.floor(Math.random()*30) == 0) && (count > 0)) {
								board[i][j].owner = p.id
								board[i][j].pct = 1
								p.armies[count] = {
									id: count,
									x: i*50,
									y: j*50,
									moveTime: new Date().getTime(),
									speed: 500,
									rank: 0,
									xp: 0,
									hp: 100,
									atk: 1
								}
								p.currentArmy = 1
								count -= 1
							}
						}
					}
				}
			}
		})

		// send new board to clients
		io.emit('drawNewBoard', {board: board, players: players})
	})

	socket.on('startGame', () => {
		if (board.length) {
			for(i=0; i<Object.keys(players).length; i++) {
				lobby.shift()
			}
			
			io.emit('lobbyUpdate', lobby)
			
			LEVEL_UP_SPEED = 4 / Object.keys(players).length
			CAPTURE_SPEED = .1 / Object.keys(players).length

			game = true
		}
	})

	socket.on('selectArmy', (armyNum) => {
		let player = players[socket.id]
		if (player.armies[armyNum]) {
			player.currentArmy = armyNum
		}
	})

	socket.on('prevArmy', () => {
		let player = players[socket.id]
		if (Object.keys(player.armies).length > 1) {
			let idx = Object.keys(player.armies).indexOf(player.currentArmy.toString()) - 1
			if (idx < 0) {
				idx = Object.keys(player.armies).length - 1
			}
			player.currentArmy = Object.keys(player.armies)[idx]
		}
	})

	socket.on('nextArmy', () => {
		nextArmy(socket.id)
	})

	// create a new army
	socket.on('newArmy', direction => {
		let player = players[socket.id]
		let army = player.armies[player.currentArmy]
		let numberOfArmies = Object.keys(player.armies).length

		// check zone count
		if ((numberOfArmies < 2) || (numberOfArmies < Math.floor(player.zones / 4) && numberOfArmies < 9)) {
			if (army.rank >= 2) {
				let newPos
				
				switch(direction) {
					case 'up':
						newPos = { x: army.x, y: army.y - 50 }
						break
					case 'down':
						newPos = { x: army.x, y: army.y + 50 }
						break
					case 'right':
						newPos = { x: army.x + 50, y: army.y }
						break
					case 'left':
						newPos = { x: army.x - 50, y: army.y }
						break
				}
			
				if (isValidPosition(newPos)) {
					let armyID
					for(i=1; i<10; i++) {
						if (player.armies[i] == undefined) {
							armyID = i
							break
						}
					}
					
					player.armies[armyID] = {
						id: armyID,
						x: newPos.x,
						y: newPos.y,
						moveTime: new Date().getTime(),
						speed: 500,
						rank: 0,
						xp: Math.floor(army.xp / 2),
						hp: army.hp,
						atk: 1				
					}	
					
					army.xp /= 2
				}
			}
		}
	})

	socket.on('move', msg => {

		let player = players[socket.id]
		let army = player.armies[player.currentArmy]

		if (army) {
			if ((new Date().getTime() - army.moveTime) < army.speed) {
				return
			}
			
			if (msg == 'up') {
				movePlayer(socket.id, 0, -50)
			} else if (msg == 'down') {
				movePlayer(socket.id, 0, 50)
			} else if (msg == 'right') {
				movePlayer(socket.id, 50, 0)
			} else if (msg == 'left') {
				movePlayer(socket.id, -50, 0)
			}
			
			army.moveTime = new Date().getTime()
		}

	})
		
	socket.on('disconnect', () => {
		console.log('user discnnect:', socket.id)

		// remove if in lobby
		if (lobby.indexOf(socket.id) > -1) {
			lobby.splice(lobby.indexOf(socket.id), 1)
		}
		io.emit('lobbyUpdate', lobby)

		// prepare to remove in the game
		// (can't remove them during game)
		if (players[socket.id]) {
			to_remove.push(socket.id)
		}
  })
	
	// the game loop
	setInterval(emitUpdates, 200)
})

function movePlayer(id, dx, dy) {
	let player = players[id]
	let army = player.armies[player.currentArmy]
	let newPos = { x: army.x + dx, y: army.y + dy }
	if(isValidPosition(newPos)) {
		army.x += dx
		army.y += dy
	}
}

function isValidPosition(newPos) {

	newI = newPos.x / 50
	newJ = newPos.y / 50

	// check boundaries
	if (newPos.x < 0 || newPos.x + playerSize > gameSize) {
		return false
	}
	if (newPos.y < 0 || newPos.y + playerSize > gameSize) {
		return false
	}

	// check barriers
	if (barriers.filter(b => b.x == newI && b.y == newJ).length) {
		return false
	}

	// check other armies
	collision = false
	Object.values(players).forEach(p => {
		Object.values(p.armies).forEach(a => {
			if(a.x == newPos.x && a.y == newPos.y) {
				collision = true
			}
		})
	})

	if (collision) {
		return false
	}

	return true
}

function nextArmy(pid) {
	let player = players[pid]
	
	// only toggle if they have more than one army
	if (Object.keys(player.armies).length > 1) {
		let idx = Object.keys(player.armies).indexOf(player.currentArmy.toString()) + 1
		if (idx == Object.keys(player.armies).length) {
			idx = 0
		}
		player.currentArmy = Object.keys(player.armies)[idx]
	
	// if they toggled (or this func was called internally when an army is killed)
	// then just select the last remaining army
	} else if (Object.keys(player.armies).length == 1) {
		player.currentArmy = Object.keys(player.armies)[0]
	
	}

	// if there is no remaining army, then the player is eliminated.
	// if there is only one player left, then game over.
	// (this is all handled in `updateZones()`)
}

function updateZones() {

	playersWithArmies = 0

	Object.values(players).forEach(p => {

		armyCount = 0

		Object.values(p.armies).forEach(a => {

			armyCount += 1

			gridX = a.x / 50
			gridY = a.y / 50

			// being capturing zone if empty
			if(board[gridX][gridY].pct <= 0) {
				board[gridX][gridY].owner = p.id
			}

			// continue capturing zone
			if(board[gridX][gridY].owner == p.id && board[gridX][gridY].pct < 1) {
				board[gridX][gridY].pct += CAPTURE_SPEED
				a.xp += LEVEL_UP_SPEED
			}

			// take zone from enemy
			if(board[gridX][gridY].owner != p.id && board[gridX][gridY].pct > 0) {
				board[gridX][gridY].pct -= CAPTURE_SPEED
				a.xp += LEVEL_UP_SPEED
			}

			// check if enemy armies are nearby (to attack them)
			Object.values(players).filter(p2 => p2.id != p.id).forEach(p2 => {
				Object.values(p2.armies).forEach(a2 => {
					if(Math.abs(a2.x - a.x) == 50 && a2.y == a.y) {
						a2.hp -= Math.floor(Math.random() * (3 + a.rank))
						a.xp += LEVEL_UP_SPEED
					}
					if(Math.abs(a2.y - a.y) == 50 && a2.x == a.x) {
						a2.hp -= Math.floor(Math.random() * (3 + a.rank))
						a.xp += LEVEL_UP_SPEED
					}
				})
			})

			// check if friendly armies are nearby (to heal them)
			Object.values(p.armies).filter(a2 => a2.id != a.id).forEach(a2 => {
				if(Math.abs(a2.x - a.x) == 50 && a2.y == a.y) {
					if(a.hp >= a2.hp && a2.hp < 100) {
						a2.hp += Math.floor(Math.random() * (1 + a.rank))
					}
				}
				if(Math.abs(a2.y - a.y) == 50 && a2.x == a.x) {
					if(a.hp >= a2.hp && a2.hp < 100) {
						a2.hp += Math.floor(Math.random() * (1 + a.rank))
					}
				}
			})

			// calculate the rank based on XP
			a.rank = Math.floor(a.xp / 100)
		
			// check if the army is dead
			if(a.hp <= 0) {
				delete p.armies[a.id]
				nextArmy(p.id)
			}

		})

		playersWithArmies += armyCount ? 1 : 0

		// count up the zones controlled by each player
		p.zones = board.flatMap(z => z).filter(z => z.owner == p.id && z.pct >= 1).length
	})


	// handle game over
	if (playersWithArmies == 1) {
		game = false
		io.emit('gameOver')

		Object.keys(players).forEach(id => {
			if (to_remove.indexOf(id) == -1) {
				lobby.push(id)
			}
		})

		to_remove = []

		io.emit('lobbyUpdate', lobby)
	}

}


http.listen(3000, () => {
  console.log('listening on *:3000')
})