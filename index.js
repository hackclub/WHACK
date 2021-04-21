// load up .env
require('dotenv').config()

const { App } = require('@slack/bolt')
const { WebClient } = require('@slack/web-api')

const { Game } = require('./game')
const { rand, randItem, humanizeDuration } = require('./util')

const signingSecret = process.env.SLACK_SIGNING_SECRET
const botToken = process.env.SLACK_BOT_TOKEN

// this channel ID must already be created
const channelToRunIn = process.env.WHACK_A_MOLE_CHANNEL

// game state variables, 1 game at a time
let
  gameInProgress = false,
  whacked,
  gameStartTime,
  lastWinner,
  lastWinnerTime


const app = new App({
  signingSecret: signingSecret,
  token: botToken,
})

// re-initialize WebClient with our bot token, so it's globally available. normally WebClient does not inject the bot token into requests because the app may be running across multiple slack workspaces
app.client = new WebClient(botToken)

async function handleWhack({ body, ack, say }) {
  await ack()

  if (whacked) {
    return
  }

  console.log(body)
  debugger

  // we need to make sure there is 1 and only 1 action given to us. i'm not
  // sure why there would be multiple, i've never had this happen, but this is
  // just in case
  if (body.actions.length != 1) {
    return
  }

  let msg = body.message
  let action = body.actions[0]

  app.client.chat.postMessage({
    channel: body.channel.id,
    thread_ts: msg.ts,
    text: `WHACK by ${body.user.name}`
  })

  if (action.value != 'gopher') {

    try {
      await app.client.reactions.add({
        channel: body.channel.id,
        name: randItem(reactions),
        timestamp: msg.ts
      })
    } catch {
      // don't do anything, it's ok if we already reacted with the emoji and
      // the above errors
    }

    return
  }

  whacked = true
  lastWinner = body.user.id
  lastWinnerTime = new Date() - gameStartTime

  msg.blocks[0].text = {
    type: "plain_text",
    text: `WHACK A MOLE - WHACKED`,
    emoji: true
  }

  msg.blocks[1].elements[0].text = `<@${lastWinner}> WON in ${humanizeDuration(lastWinnerTime)}`

  await app.client.chat.update({
    channel: body.channel.id,
    ...msg
  })
}

app.action({ block_id: 'whack_options_row_0' }, handleWhack)
app.action({ block_id: 'whack_options_row_1' }, handleWhack)
app.action({ block_id: 'whack_options_row_2' }, handleWhack)
app.action({ block_id: 'whack_options_row_3' }, handleWhack)
app.action({ block_id: 'whack_options_row_4' }, handleWhack)
app.action({ block_id: 'whack_options_row_5' }, handleWhack)
app.action({ block_id: 'whack_options_row_6' }, handleWhack)
app.action({ block_id: 'whack_options_row_7' }, handleWhack)

const generateBlocksForButtons = (buttonOptions, rows) => {
  let blocks = []

  let row = 0
  let inProgressRow = {
    type: 'actions',
    block_id: `whack_options_row_${row}`,
    elements: []
  }
  let buttonsPerRow = buttonOptions.length / rows
  for (let b = 0; b < buttonOptions.length; b++) {
    inProgressRow.elements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: buttonOptions[b].gopher ? randItem(gopherOptions) : randItem(grassOptions),
        emoji: true
      },
      value: buttonOptions[b].gopher ? 'gopher' : 'grass',
      action_id: buttonOptions[b].valueb
    })

    // if buttonsPerRow is 4, then this triggers on every 4th item
    if ((b+1) % buttonsPerRow == 0) {
      blocks.push(inProgressRow)
      row++
      inProgressRow = {
        type: 'actions',
        block_id: `whack_options_row_${row}`,
        elements: []
      }
    }
  }

  return blocks
}

const generateGameBoard = (
  totalButtons, totalRows, gopherIndex,
  lastWinnerID = null, lastWinnerTime = null
) => {
  const buttonOptions = Array(totalButtons).fill().map((_, i) => {
    let isGopher = (i == gopherIndex)

    return {
      actionId: `option_${i}`,
      gopher: isGopher
    }
  })

  const generatedBlocks = generateBlocksForButtons(buttonOptions, totalRows)

  const lastWinnerText = lastWinnerID ?
    `<@${lastWinnerID}> was the last winner in ${humanizeDuration(lastWinnerTime)}` :
    'i am a silly bot and have no memory of the last winner'

  return {
    channel: channelToRunIn,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "WHACK THAT MOLE",
          emoji: true
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: lastWinnerText
          }
        ]
      },
    ].concat(generatedBlocks)
  }
}

const startNewGame = async () => {
  const totalButtons = 48
  const totalRows = 8
  let gopherIndex = rand(0, totalButtons)

  whacked = false
  gameStartTime = new Date()

  const board = generateGameBoard(totalButtons, totalRows, gopherIndex, lastWinner, lastWinnerTime)

  const initialPostMsg = await app.client.chat.postMessage(board)

  await app.client.reactions.add({
    channel: initialPostMsg.channel,
    name: randItem(reactions),
    timestamp: initialPostMsg.ts
  })

  setInterval(() => {
    if (whacked) {
      return true
    }

    gopherIndex = rand(0, totalButtons)
    const newBoard = generateGameBoard(totalButtons, totalRows, gopherIndex)

    app.client.chat.update({
      ts: initialPostMsg.ts,
      ...newBoard
    })
  }, 500)
}

const whack = async ({ msg }) => {
  if (gameInProgress) {
    await app.client.chat.postMessage({
      channel: msg.channel,
      ts: msg.ts,
      text: 'WHACK'
    })

    return
  }

  //await startNewGame()
  let game = new Game()

  await game.startNewGame(app)
}

app.message('WHACK', whack)
app.message(':wack:', whack)

console.log('starting the app!...'); // need a semicolon here for the below async statement to work

(async () => {
  // join the whack a mole channel
  try {
    await app.client.conversations.join({ channel: channelToRunIn })
  } catch (err) {
    console.error("Error joining $WHACK_A_MOLE_CHANNEL. Please make sure that environment variable is properly set. See full error:", err)
  }

  const port = process.env.PORT || 3000
  await app.start(port)

  console.log('whack-a-mole running on port', port)
})();

