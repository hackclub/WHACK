// load up .env
require('dotenv').config()

const { App } = require('@slack/bolt')
const { WebClient } = require('@slack/web-api')

const { Game } = require('./game')
const { rand, randItem, humanizeDuration } = require('./util')

const signingSecret = process.env.SLACK_SIGNING_SECRET
const botToken = process.env.SLACK_BOT_TOKEN

// this channel ID must already be created
const channelIDToRunIn = process.env.WHACK_A_MOLE_CHANNEL_ID

// game state variables, 1 game at a time
let
  gameInProgress = false,
  lastWinnerID,
  lastWinnerTime


const app = new App({
  signingSecret: signingSecret,
  token: botToken,
})

// re-initialize WebClient with our bot token, so it's globally available. normally WebClient does not inject the bot token into requests because the app may be running across multiple slack workspaces
app.client = new WebClient(botToken)

const whack = async ({ message }) => {
  if (gameInProgress) {
    await app.client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: "wack _(a game is already in progress)_"
    })

    return
  }

  let game = new Game(channelIDToRunIn, 500, 0, 48, 8, lastWinnerID, lastWinnerTime)

  game.registerWhackCallbacks(app)

  gameInProgress = true

  let res = await game.startNewGame(app); // need this semicolon for some reason
  [ lastWinnerID, lastWinnerTime ] = res

  gameInProgress = false
}

app.message('WHACK', whack)
app.message(':wack:', whack)

console.log('starting the app!...'); // need a semicolon here for the below async statement to work

(async () => {
  // join the whack a mole channel
  try {
    await app.client.conversations.join({ channel: channelIDToRunIn })
  } catch (err) {
    console.error("Error joining $WHACK_A_MOLE_CHANNEL. Please make sure that environment variable is properly set. See full error:", err)
  }

  const port = process.env.PORT || 3000
  await app.start(port)

  console.log('whack-a-mole running on port', port)
})();

