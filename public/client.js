let socket = io()

$(function() {
	let canvas = document.getElementById('game')
	let ctx = canvas.getContext('2d')

	socket.on('lobbyUpdate', updateLobby) 
	socket.on('drawNewBoard', drawNewBoard)
	socket.on('gameStateUpdate', updateGameState)
	socket.on('gameOver', gameOver)

	drawPlayers = players => {
		Object.keys(players).forEach( pid => {
			let player = players[pid]
			
			Object.values(player.armies).forEach(a => {
				ctx.beginPath()
				ctx.lineWidth = "3"
				ctx.strokeStyle = `rgb(${player.color1[0]}, ${player.color1[1]}, ${player.color1[2]})`
				ctx.rect(a.x+10, a.y+13, 30, 30)
				ctx.stroke()

				ctx.fillStyle = 'black'
				ctx.font = "18px Arial"
				ctx.fillText(a.rank, (a.x + 17), (a.y + 33))

				ctx.font = "12px Arial"
				ctx.fillText(a.id, (a.x + 30), (a.y + 25))
				
				if (a.id == player.currentArmy) {
					ctx.fillRect(a.x+15, a.y+37, 20, 2)
				}

				ctx.fillStyle = 'black'
				ctx.fillRect(a.x+9, a.y+5, 32*(a.hp / 100), 5)
			})

		})
	}

	// key bindings
	$('html').keydown(e => {

		// movement
		if (e.key == "ArrowDown" || e.key == "s") {
			socket.emit('move', 'down')

		} else if (e.key == "ArrowUp" || e.key == "w") {
			socket.emit('move', 'up')

		} else if (e.key == "ArrowLeft" || e.key == "a") {
			socket.emit('move', 'left')

		} else if (e.key == "ArrowRight" || e.key == "d") {
			socket.emit('move', 'right')
		}

		// split army
		else if (e.key == 'W') {
			socket.emit('newArmy', 'up')
		
		} else if (e.key == 'S') {
			socket.emit('newArmy', 'down')
		
		} else if (e.key == 'A') {
			socket.emit('newArmy', 'left')
		
		} else if (e.key == 'D') {
			socket.emit('newArmy', 'right')
		}

		// select army
		else if (e.key in [1,2,3,4,5,6,7,8,9]) {
			socket.emit('selectArmy', e.key)
		
		} else if (e.key == 'q') {
			socket.emit('prevArmy')
		
		} else if (e.key == 'e') {
			socket.emit('nextArmy')

		} 

	})

	function updateLobby(lobby) {
		let html = "<ul>"
		lobby.forEach(guest => {
			html += (socket.id == guest)
			? `<li><strong>Guest ${guest.substr(0,4)}</strong></li>`
			: `<li>Guest ${guest.substr(0,4)}</li>`
		})
		document.getElementById('lobby-list').innerHTML = html
	}

	function updateGameState(state) {
		drawNewBoard(state)
		drawPlayers(state.players)
		updateUI(state.players)
	}

	function updateUI(players) {

		console.log('updateing uUI')

		let html = '<ul class="sublist">'
		Object.values(players).forEach(p => {
			
			html += (socket.id == p.id)
			? `<li><strong>${p.name}</strong>, zones: ${p.zones}<ul>`
			: `<li>${p.name}, zones: ${p.zones}<ul>`

			Object.values(p.armies).forEach(a => {
				html += `<li>Army #${a.id}, Rank: ${a.rank}, HP: ${a.hp}`
			})
			html += '</ul></li>'
		})
		document.getElementById('player-list').innerHTML = html
	}
	
	function drawNewBoard(state) {

		ctx.clearRect(0, 0, canvas.width, canvas.height)

		for(i=0; i<10; i++) {
			for(j=0; j<10; j++) {
				ctx.beginPath()
				
				if(state.board[i][j].owner == 'noone') {
					ctx.fillStyle = 'black'
					ctx.fillRect(i*50, j*50, 50, 50)
				
				} else if (state.board[i][j].owner != '') {
					let color = state.players[state.board[i][j].owner].color2
					ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, .4)`
					ctx.rect(i*50, j*50+(50 * (1-state.board[i][j].pct)), 50, 50*state.board[i][j].pct)
					ctx.fill()
				}
			}
		}

		// grid
		ctx.strokeStyle = 'black'
		ctx.lineWidth = 1
		for(i=0; i<11; i++) {
			ctx.moveTo(0,50*i)
			ctx.lineTo(500,50*i)
			ctx.moveTo(50*i,0)
			ctx.lineTo(50*i,500)
		}
		ctx.stroke()
	}

	function gameOver() {
		console.log('game over')
		document.getElementById('game-info').innerHTML = '<p>game over!</p>'
	}

})

// functions outside of the jQuery thing
// for buttons on page
function newBoard() {
	socket.emit('newBoard')
}

function startGame() {
	socket.emit('startGame')
	document.getElementById('game-info').innerHTML = ''
}