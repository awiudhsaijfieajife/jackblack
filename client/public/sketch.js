//import socket from "socket.io-client";
const socket = io("http://localhost:3000");
socket.on("connect", () => {   
    console.log("Connected to server");
});
let deck = [];
let playerHand = [];
let dealerHand = [];
let tempHints = [];

// New: Action cards for both players
let playerActionCards = [];
let dealerActionCards = [];
let playerUsedActionCards = [];
let dealerUsedActionCards = [];

// New: Action card menu
let showActionMenu = true;
let actionMenuX;
let actionMenuWidth = 200;
let actionMenuScrollY = 0; // Scroll offset for action menu

let playerScore = 0;
let dealerScore = 0;
let currentBet = 0;
let roundBet = currentBet;

// Game states: 'betting', 'dealing', 'playerTurn', 'dealerTurn', 'gameOver', 'shuffling', 'roundOver'
let gameState = "betting"; // Start with betting (though we won't implement betting UI)
let boringTurns = 0; // If both players go through their turns standing and not doing anything the game ends
let message = "Click to start!";
let targetScore = 21;

let isMobile = false;
let touchX = 0;
let touchY = 0;

let ua = navigator.userAgent;
if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua) || navigator.maxTouchPoints > 0) {
  isMobile = true;
}

let cardFlip, actionSound, useSound;

let hitButton, standButton, spb, mpb, actionMenuButton;

// Card dimensions adjusted to accommodate action cards
const cardWidth = 70;
const cardHeight = 90; // Smaller card height
const cardSpacing = 15;
const actionCardWidth = 120;
const actionCardHeight = 90;
const actionCardSpacing = 10;

// --- Action Cards Definition ---
const actionCardTypes = [
  {
    id: "limit27",
    name: "Limit 27",
    description: "Sets target score to 27",
    color: "#4a9e5c",
    function: "setLimit27",
    displayOnTable: true,
  },
  {
    id: "limit17",
    name: "Limit 17",
    description: "Sets target score to 17",
    color: "#b55088",
    function: "setLimit17",
    displayOnTable: true,
  },
  {
    id: "return",
    name: "Return",
    description: "Return the last card you drew",
    color: "#5088b5",
    function: "returnCard",
    displayOnTable: false,
  },
  {
    id: "perfectDraw",
    name: "Perfect Draw",
    description: "Draw the best possible card in the deck.",
    color: "#b5a650",
    function: "perfectDraw",
    displayOnTable: false,
  },
  {
    id: "friendship",
    name: "Friendship",
    description: "Both players draw 2 action cards",
    color: "#8850b5",
    function: "friendship",
    displayOnTable: false,
  },
  {
    id: "lockIn",
    name: "Lock In",
    description:
      "Remove opponent's last placed action card, then draws an action card",
    color: "#555555",
    function: "lockIn",
    displayOnTable: false,
  },
  {
    id: "bloodshed",
    name: "Bloodshed",
    description: "Increase the bet by 1",
    color: "#b55050",
    function: "bloodshed",
  },
  {
    id: "armistice",
    name: "Armistice",
    description: "Decrease the bet by 1",
    color: "#87b5ff",
    function: "armistice",
  },
  {
    id: "remove",
    name: "Remove",
    description: "Remove a card from the opponent's hand",
    color: "#ac43e0",
    function: "removeCard",
    displayOnTable: false,
  },
  {
    id: "refresh",
    name: "Refresh",
    description: "Returns all your cards, then draws 2 new ones",
    color: "#ac43e0",
    function: "refreshDeck",
    displayOnTable: false,
  }
];

// --- Action Card Functions ---
function setLimit27() {
  targetScore = 27;
  message = "Target score changed to 27!";
  return true;
}

function setLimit17() {
  targetScore = 17;
  message = "Target score changed to 17";
  return true;
}

function returnCard() {
  deck.push(playerHand.pop()[0]);
  shuffleDeck();
  // don't change penalty score here
  return true;
}

function perfectDraw() {
  // don't set penalty score; use local hand value
  let baseValue = calculateHandValue(playerHand, true);
  let highestScore = 0;
  let chosenCard;
  for (let card of deck) {
    let newScore = baseValue + int(card.rank);
    if (newScore <= targetScore && newScore > highestScore) {
      chosenCard = card;
      highestScore = newScore;
    }
  }
  if (chosenCard) {
    deck.splice(deck.indexOf(chosenCard), 1);
    playerHand.push([chosenCard, false]);
    message = "You drew the best possible card!";
  } else {
    return false;
  }
  return true;
}

function friendship() {
  // Give both players 2 random action cards
  dealActionCards(2, "player");
  dealActionCards(2, "dealer");
  return true;
}

function lockIn() {
  if (dealerUsedActionCards.length > 0) {
    dealerUsedActionCards.pop();
    message = "Removed dealer's last action card!";
  }
  dealActionCards(1, 'player');
  return true;
}

function bloodshed() {
  roundBet += 1;
  message = "Bet increased by 1!";
  return true;
}

function armistice() {
  roundBet -= 1;
  if (roundBet < 0) {
    roundBet = 0;
  }
  message = "Bet decreased by 1!";
  return true;
}

function removeCard() {
  if (dealerHand.length > 0) {
    dealerHand.pop();
    message = "Removed a card from the dealer's hand!";
  } else {
    message = "No cards to remove!";
  }
  return true;
}

function refreshDeck() {
  for (let cardInfo of playerHand) {
    deck.push(cardInfo[0]);
  }
  playerHand = [];
  shuffleDeck();
  dealCard(playerHand);
  dealCard(playerHand);
  message = "You drew 2 new cards!";
  return true;
}

function joinroom() {
  rmid = createInput("");
  rmid.size(width / 2, 80);
  rmid.position(0, height - 80);
  rmid.elt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      rmid.hide();
      message = "Joining room...";
      let roomID = rmid.value();
      console.log("user tried to join room", roomID + "\n");
      socket.emit("joinRoom", roomID);
      socket.on("error", (err) => {
        console.log(err + "\n");
        message = err;
        crtrm.show();
        sltrm.show();
        sltrm.show();
        crtrmin.hide();
      });
      socket.on("joinedRoom", (roomId) => {
        message = `Joined room ${roomId}\n`;
        spb.hide();
        mpb.hide();
        actionMenuButton.show();
        socket.emit("startGame", roomId);
        message = `Game started in room ${roomId}\n`;
        console.log("game started in room", roomId + "\n");
        actionMenuButton.show();
      });
    }
  });
}

function mpbselect(){
    crtrm = createButton("Create Room");
    crtrm.size(width / 2, 80);
    crtrm.position(0, height - 80);
    crtrm.mousePressed(() => {
        mpb.hide();
        spb.hide();
        crtrm.hide();
        createroom();
    });
    sltrm = createButton("Select Room");
    sltrm.size(width / 2, 80);
    sltrm.position(width / 2, height - 80);
    sltrm.mousePressed(() => {
        message = "enter room id";
        sltrm.hide();
        crtrm.hide();
        joinroom();
        
    });
}

function createroom(){
    let crtrmin = createInput("");
    crtrmin.size(width / 2, 80);
    crtrmin.position(0, height - 80);
    sltrm.hide();
    crtrm.hide();
    let roomID;
    crtrmin.elt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            crtrmin.hide();
             roomID = crtrmin.value();
            message = `Creating room ${roomID}...`;
            console.log("user tried to create room", roomID + "\n");
            socket.emit("createRoom", roomID);
        }
    });
    crtrm.hide();
    sltrm.hide();
    socket.on("roomCreated", (roomId) => {
        message = `Created room ${roomId}\n`;
        console.log("user created room", roomId + "\n");
        spb.hide();
        mpb.hide();
        actionMenuButton.show();
        message = `waiting for other player to join...\n`;

    });
    socket.on("gameStarted", (roomId) => {
        message = `Game started in room ${roomId}\n`;
        console.log("game started in room", roomId + "\n");
        actionMenuButton.show();
    });
    socket.on("error", (err) => {  
        console.log(err + "\n");
        message = err;
        crtrmin.show();
        crtrm.show();
        sltrm.show();
        crtrmin.hide();
    
});
    

}

// --- Preload ---
function preload() {
  cardFlip = loadSound("cardflip.mp3");
  actionSound = loadSound("action.mp3");
  useSound = loadSound("use.mp3");
}

// --- Setup ---
function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  textFont("monospace");

  // Calculate menu position
  actionMenuX = width - actionMenuWidth;

  // enable right click
  for (let element of document.getElementsByClassName("p5Canvas")) {
    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // --- Create Buttons ---
  hitButton = createButton("Hit");
  hitButton.size(width / 2, 80);
  hitButton.position(0, height - 80);
  hitButton.mousePressed(playerHit);
  hitButton.hide(); // Hide initially

  standButton = createButton("Stand");
  standButton.size(width / 2, 80);
  standButton.position(width / 2, height - 80);
  standButton.mousePressed(playerStand);
  standButton.hide(); // Hide initially

  spb = createButton("Singleplayer");
  mpb = createButton("Multiplayer");
  spb.size(width / 2, 80);
    spb.position(0, height - 80);
    spb.mousePressed(() => {
        message = "Singleplayer mode selected!";    
        spb.hide(); 
        mpb.hide();
        newGame();
    });
    mpb.size(width / 2, 80);
    mpb.position(width / 2, height - 80);
    mpb.mousePressed(() => {
        message = "Multiplayer mode selected!";
        mpb.hide();
        spb.hide();
        mpbselect();
    });
  //spb.mousePressed(newGame);
  // newGameButton initially visible if game starts over

  actionMenuButton = createButton("Show action cards");
  actionMenuButton.size((width / 4) * 3, 35);
  actionMenuButton.position(0, 0);
  actionMenuButton.mousePressed(() => {
    showActionMenu = !showActionMenu;
  });
  actionMenuButton.hide();

  // Initialize game (but don't deal yet)
  buildDeck();
  shuffleDeck();
  // newGame(); // Call newGame initially if you want it to start automatically
}

// --- Draw Loop ---
function draw() {
  background("#386641"); // Forest green background
  
  drawBetting();

  drawHands();

  drawActionCards();

  drawScores();

  drawMessage();

  // Draw action menu if open
  if (showActionMenu) {
    drawActionMenu();
  }

  // Update hints
  updateTempHints();

  // Optional: Game logic checks within draw (can also be purely event-driven)
  if (gameState === "dealerTurn") {
    dealerPlay(); // Automatically handle dealer's turn
  }
}

// --- Card and Deck Functions ---
function buildDeck() {
  deck = [];
  const ranks = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

  for (let rank of ranks) {
    deck.push({ rank });
  }
}

function shuffleDeck() {
  // Fisher-Yates (Knuth) Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap elements
  }
}

function dealCard(hand, hidden = false) {
  if (deck.length > 0) {
    hand.push([deck.pop(), hidden]);
    cardFlip.play();
    return true; // Card dealt successfully
  }
  return false; // No cards left
}

function getCardValue(card) {
  if (["J", "Q", "K"].includes(card.rank)) {
    return 10;
  } else if (card.rank === "A") {
    return 11; // Handle Ace logic in calculateHandValue
  } else {
    return parseInt(card.rank);
  }
}

function calculateHandValue(hand, considerHiddenCards = false) {
  let score = 0;
  let aceCount = 0;
  for (let cardInfo of hand) {
    let card = cardInfo[0];
    let hidden = cardInfo[1];
    if (hidden && !considerHiddenCards) {
      continue;
    }

    score += getCardValue(card);
    if (card.rank === "A") {
      aceCount++;
    }
  }
  while (score > targetScore && aceCount > 0) {
    score -= 10;
    aceCount--;
  }
  return score;
}

// --- Drawing Functions ---
function drawCard(cardInfo, x, y) {
  let card = cardInfo[0];
  let hidden = cardInfo[1];
  push(); // Isolate drawing styles
  translate(x, y);

  // Card background
  fill(255);
  stroke(0);
  strokeWeight(1);
  rect(0, 0, cardWidth, cardHeight, 5); // Rounded corners

  if (!hidden) {
    fill(0); // Black

    textSize(36);
    textAlign(CENTER, CENTER);
    text(card.rank, cardWidth / 2, cardHeight / 2);
    textSize(20);
  } else {
    // Draw card back (simple pattern)
    fill("#a2d2ff"); // Light blue back
    stroke(0);
    for (let i = 5; i < cardWidth; i += 10) {
      line(i, 0, i, cardHeight);
    }
    for (let j = 5; j < cardHeight; j += 10) {
      line(0, j, cardWidth, j);
    }
  }
  pop(); // Restore previous styles
}

function drawActionCard(card, x, y, selectable = false) {
  push();
  translate(x, y);

  // Card background
  if (
    selectable &&
    mouseX > x &&
    mouseX < x + actionCardWidth &&
    mouseY > y &&
    mouseY < y + actionCardHeight
  ) {
    // Highlight on hover if selectable
    fill(card.color);
    stroke(255);
    strokeWeight(3);
  } else {
    fill(card.color);
    stroke(0);
    strokeWeight(1);
  }

  rect(0, 0, actionCardWidth, actionCardHeight, 5); // Rounded corners

  // Card text
  fill(255);
  textSize(14);
  textAlign(CENTER, CENTER);
  strokeWeight(1);
  text(card.name, actionCardWidth / 2, actionCardHeight / 3);

  textSize(10);
  text(card.description, 0, (actionCardHeight * 2) / 3, actionCardWidth);

  pop();
}

function drawActionCards() {
  // Draw all dealer used action cards
  let dx =
    width / 2 -
    ((dealerUsedActionCards.length - 1) *
      (actionCardWidth + actionCardSpacing)) /
      2;
  dealerUsedActionCards.forEach((cardId, i) => {
    let cardType = getCardTypeById(cardId);
    if (cardType && cardType.displayOnTable) {
      drawActionCard(
        cardType,
        dx + i * (actionCardWidth + actionCardSpacing),
        50 - actionCardHeight - 10
      );
    }
  });

  // Draw all player used action cards
  let px =
    width / 2 -
    ((playerUsedActionCards.length - 1) *
      (actionCardWidth + actionCardSpacing)) /
      2;
  playerUsedActionCards.forEach((cardId, i) => {
    let cardType = getCardTypeById(cardId);
    if (cardType && cardType.displayOnTable) {
      drawActionCard(
        cardType,
        px + i * (actionCardWidth + actionCardSpacing),
        height - cardHeight - 100 - actionCardHeight - 10
      );
    }
  });
}

function drawHands() {
  // Draw Dealer's Hand
  let dealerX =
    width / 2 -
    (dealerHand.length * (cardWidth + cardSpacing) - cardSpacing) / 2;
  for (let i = 0; i < dealerHand.length; i++) {
    drawCard(dealerHand[i], dealerX + i * (cardWidth + cardSpacing), 50);
  }

  // Draw Player's Hand
  let playerX =
    width / 2 -
    (playerHand.length * (cardWidth + cardSpacing) - cardSpacing) / 2;
  for (let i = 0; i < playerHand.length; i++) {
    drawCard(
      playerHand[i],
      playerX + i * (cardWidth + cardSpacing),
      height - cardHeight - 100
    );
  }
}

function drawScores() {
  textSize(20);
  textAlign(CENTER, CENTER);

  // Dealer hand value
  let dealerHandValue = calculateHandValue(dealerHand);
  let dealerScoreText;
  let dealerHasHiddenCards = dealerHand.some((i) => i[1] === true);
  if (dealerHasHiddenCards && dealerHand.length > 0) {
    dealerScoreText = `?+${dealerHandValue} / ${targetScore}`;
    fill(dealerHandValue <= targetScore ? 255 : "rgb(228,108,108)");
  } else if (dealerHand.length > 0) {
    dealerScoreText = `${dealerHandValue} / ${targetScore}`;
    if (dealerHandValue < targetScore) fill(255);
    else if (dealerHandValue == targetScore) fill("rgb(110,226,110)");
    else fill("rgb(228,108,108)");
  } else {
    dealerScoreText = `0 / ${targetScore}`;
    fill(255);
  }
  text(dealerScoreText, width / 5, 50);

  // Player hand value
  let playerHandValue = calculateHandValue(playerHand);
  if (playerHandValue < targetScore) fill(255);
  else if (playerHandValue == targetScore) fill("rgb(110,226,110)");
  else fill("rgb(228,108,108)");
  text(
    `${playerHandValue} / ${targetScore}`,
    width / 5,
    height - cardHeight - 120
  );

  // Draw action card count
  fill(255);
  textSize(14);
  text(
    `Action Cards: ${playerActionCards.length}\n(Space to show)`,
    width / 5,
    height - cardHeight - 90
  );
}

function drawMessage() {
  push();
  textSize(24);
  noStroke();
  textAlign(CENTER, CENTER);
  rectMode(CENTER);
  fill(0, 70);
  rect(width / 2, height / 2, message.length * 14, 40, 5);
  fill(255);
  text(message, width / 2, height / 2);
  pop();
}

function drawActionMenu() {
  // Draw menu background
  fill(0, 0, 0, 200);
  rect(actionMenuX, 0, actionMenuWidth, height);

  // Menu title
  textSize(18);
  fill(255);
  textAlign(CENTER);
  text("Action Cards", actionMenuX + actionMenuWidth / 2, 30);

  // --- SCROLLABLE ACTION CARDS ---
  let visibleHeight = height - 100; // Space for cards
  let totalCardsHeight = playerActionCards.length * (actionCardHeight + 20);
  let maxScroll = Math.max(0, totalCardsHeight - visibleHeight);
  actionMenuScrollY = Math.max(0, Math.min(actionMenuScrollY, maxScroll));

  push();
  // Clip drawing region to menu area
  rectMode(CORNER);
  let clipY = 70;
  let clipH = height - 100;
  // p5 doesn't have clip(), so just skip drawing out-of-bounds cards
  for (let i = 0; i < playerActionCards.length; i++) {
    let cardType = getCardTypeById(playerActionCards[i]);
    if (cardType) {
      let y = 80 + i * (actionCardHeight + 20) - actionMenuScrollY; // Core logic, offsets Y variable
      if (y + actionCardHeight < clipY || y > clipY + clipH) continue;
      drawActionCard(
        cardType,
        actionMenuX + (actionMenuWidth - actionCardWidth) / 2,
        y,
        true
      );
    }
  }
  pop();

  // Scrollbar (optional, visual only)
  if (maxScroll > 0) {
    let barHeight = Math.max(
      30,
      (visibleHeight * visibleHeight) / totalCardsHeight
    );
    let barY =
      70 + (visibleHeight - barHeight) * (actionMenuScrollY / maxScroll);
    fill(180);
    rect(actionMenuX + actionMenuWidth - 10, barY, 6, barHeight, 3);
  }

  // Close button
  fill(200, 100, 100);
  rect(actionMenuX + actionMenuWidth - 40, 10, 30, 30, 5);
  fill(255);
  textAlign(CENTER, CENTER);
  text("X", actionMenuX + actionMenuWidth - 25, 25);
}

function drawBetting() {
  // Settings
  const barX = 30;
  const barY = height * 0.15;
  const barW = 36;
  const barH = height * 0.7;
  const barMax = maxScore; // Each bar is out of 7
  const centerY = barY + barH / 2;
  push();
  fill(230);
  stroke(80);
  rect(barX, barY, barW, barH, 10);
  // Player and dealer fractions (penalty scores)
  let dScore = Math.min(playerScore, barMax);
  let pScore = Math.min(dealerScore, barMax);
  // Player bar (blue, from center down)
  let playerFrac = pScore / barMax;
  let playerH = (barH / 2) * playerFrac;
  fill(40, 80, 220);
  rect(barX, centerY, barW, playerH, 0, 0, 10, 10);
  // Dealer bar (red, from center up)
  let dealerFrac = dScore / barMax;
  let dealerH = (barH / 2) * dealerFrac;
  fill(220, 40, 40);
  rect(barX, centerY - dealerH, barW, dealerH, 10, 10, 0, 0);
  // Draw bet indicator
  fill(255, 215, 0);
  ellipse(barX + barW + 18, barY + barH / 2, 32, 32);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(roundBet, barX + barW + 18, barY + barH / 2);
  // Draw labels
  rectMode(CENTER);
  noStroke();
  fill(0, 60);
  rect(barX + barW + 40, barY + barH - 10, 75, 30, 5);
  rect(barX + barW + 40, barY + 10, 75, 30, 5);
  fill("rgb(72,124,255)");
  textSize(20);
  textAlign(LEFT, CENTER);
  text("Player", barX + barW + 8, barY + barH - 10);
  fill("rgb(255,77,77)");
  text("Dealer", barX + barW + 8, barY + 10);
  pop();
}

function updateTempHints() {
  for (let i = 0; i < tempHints.length; i++) {
    let hint = tempHints[i];
    if (hint[1] < 0) {
      tempHints.splice(i, 1);
      continue;
    }
    textSize(30);
    fill(`rgba(255, 255, 255, ${hint[1]})`);
    text(hint[0], mouseX + 5, mouseY - 5);
    hint[1] -= 0.05;
  }
}

// --- Action Card Functions ---
function getCardTypeById(id) {
  return actionCardTypes.find((card) => card.id === id);
}

function dealActionCards(actioncardNum, target) {
  let availableCards = [...actionCardTypes];

  if (target === "player") {
    for (let i = 0; i < actioncardNum; i++) {
      if (availableCards.length > 0) {
        let randomIndex = Math.floor(Math.random() * availableCards.length);
        playerActionCards.push(availableCards[randomIndex].id);
      }
    }
  } else if (target === "dealer") {
    for (let i = 0; i < actioncardNum; i++) {
      if (availableCards.length > 0) {
        let randomIndex = Math.floor(Math.random() * availableCards.length);
        dealerActionCards.push(availableCards[randomIndex].id);
      }
    }
  }
}

function useActionCard(cardIndex) {
  if (cardIndex < 0 || cardIndex >= playerActionCards.length) {
    return false;
  }

  let cardId = playerActionCards[cardIndex];
  let cardType = getCardTypeById(cardId);

  if (!cardType) {
    return false;
  }

  // Execute the card function
  boringTurns = 0;
  useSound.play();
  let functionName = cardType.function;
  if (window[functionName] && typeof window[functionName] === "function") {
    let success = window[functionName]();

    if (success) {
      // Remove the card from hand
      playerActionCards.splice(cardIndex, 1);

      // If it's a display-on-table card, add to used list
      if (cardType.displayOnTable) {
        playerUsedActionCards.push(cardId);
      }

      // Close the menu
      //showActionMenu = false;
      return true;
    } else {
      console.log("Cannot use action card! Function returned false");
    }
  }

  return false;
}

function dealerUseActionCard() {
  // Simple AI for dealer to use action cards (to be implemented)
  // For now, dealer doesn't use cards
  return false;
}

// --- Game Logic Functions ---
let maxScore = 7;
let initialActionCardsDealt = false;
let roundHasEnded = false;
let nextRoundTimeout = null;

function newGame() {
  if (gameState !== "gameOver" && gameState !== "betting") return;
  buildDeck();
  shuffleDeck();
  playerHand = [];
  dealerHand = [];
  playerUsedActionCards = [];
  dealerUsedActionCards = [];
  targetScore = 21;
  currentBet = 1; // Always reset bet
  roundBet = currentBet;
  playerScore = 0;
  dealerScore = 0;
  initialActionCardsDealt = false;
  playerActionCards = [];
  dealerActionCards = [];
  roundHasEnded = false;
  startRound();
}

function startRound() {
  // Cancel any pending nextRoundTimeout
  if (nextRoundTimeout) {
    clearTimeout(nextRoundTimeout);
    nextRoundTimeout = null;
  }
  roundBet = currentBet; // clear any changes to roundBet
  roundHasEnded = false;
  gameState = "playerTurn";
  buildDeck();
  shuffleDeck();
  playerHand = [];
  dealerHand = [];
  playerUsedActionCards = [];
  dealerUsedActionCards = [];
  targetScore = 21;
  boringTurns = 0;
  // Only deal 2 action cards at the start of the game
  if (!initialActionCardsDealt) {
    dealActionCards(2, "player");
    dealActionCards(2, "dealer");
    initialActionCardsDealt = true;
  }
  // Deal initial hands
  dealCard(playerHand);
  dealCard(dealerHand, true);
  dealCard(playerHand);
  dealCard(dealerHand);
  message = `Your turn: Hit or Stand?`;
  if (isMobile) {
    hitButton.show();
    standButton.show();
    actionMenuButton.show();
  }
  
}

function playerHit() {
  if (gameState !== "playerTurn") return;
  boringTurns = 0;
  dealCard(playerHand);
  // 25% chance to get an action card, but only after initial 2
  if (Math.random() < 0.4) {
    dealActionCards(1, "player");
    message = "You drew an action card!"; //ISSUE: Gets overwritten
    actionSound.play();
    console.log("A");
    setTimeout(() => {
      gameState = "dealerTurn";
      message = "Dealer's turn...";
    }, 1000);
  } else {
    gameState = "dealerTurn";
    message = "Dealer's turn...";
  }
}

function playerStand() {
  if (gameState !== "playerTurn") return;
  boringTurns += 1;
  gameState = "dealerTurn";
  message = "Dealer's turn...";
  hitButton.hide();
  standButton.hide();
  if (boringTurns >= 2) {
    endRound();
  }
}

function dealerPlay() {
  if (gameState !== "dealerTurn") return;
  let dVal = calculateHandValue(dealerHand, true);
  if (dVal < random(0.7,0.9) * targetScore) { // draw a card
    boringTurns = 0;
    dealCard(dealerHand);
    if (random() < 0.4) {
      dealActionCards(1, "dealer");
      // dont play sound cuz keep it secret for dealer :)
    }
  } else {
    boringTurns += 1;
    if (boringTurns >= 2) {
      endRound();
      return;
    }
  }
  gameState = "playerTurn";
  message = "Your turn!";
  if (isMobile) {
    hitButton.show();
    standButton.show();
    actionMenuButton.show();
  }
}

function endRound() {
  if (roundHasEnded) return;
  roundHasEnded = true;
  gameState = "roundOver";
  //currentBet++;

  for (let cardInfo of dealerHand) cardInfo[1] = false;
  let pVal = calculateHandValue(playerHand);
  let dVal = calculateHandValue(dealerHand);
  let winner = null;
  // If both bust, winner is closest to targetScore (not always tie)
  if (pVal > targetScore && dVal > targetScore) {
    if (Math.abs(pVal - targetScore) < Math.abs(dVal - targetScore))
      winner = "player";
    else if (Math.abs(dVal - targetScore) < Math.abs(pVal - targetScore))
      winner = "dealer";
    else winner = null;
  } else if (pVal > targetScore) winner = "dealer";
  else if (dVal > targetScore) winner = "player";
  else if (Math.abs(targetScore - pVal) < Math.abs(targetScore - dVal))
    winner = "player";
  else if (Math.abs(targetScore - dVal) < Math.abs(targetScore - pVal))
    winner = "dealer";
  // Tie: no score change
  if (winner === "player") {
    dealerScore += roundBet;
    message = `You win the round! You win ${roundBet} point(s).`;
  } else if (winner === "dealer") {
    playerScore += roundBet;
    message = `Dealer wins the round! Dealer wins ${roundBet} point(s).`;
  } else {
    message = "Push! (Tie)";
  }
  // Check for game over
  if (playerScore >= maxScore) {
    message += "\nGAME OVER: Dealer wins!";
    gameState = "gameOver";
    spb.show();
    mpb.show();
    hitButton.hide();
    standButton.hide();
    return;
  } else if (dealerScore >= maxScore) {
    message += "\nGAME OVER: Player wins!";
    gameState = "gameOver";
    spb.show();
    mpb.show();
    hitButton.hide();
    standButton.hide();
    return;
  }

  // Clear existing timeout to avoid duplicates
  if (nextRoundTimeout) {
    clearTimeout(nextRoundTimeout);
  }
  // Schedule next round once
  nextRoundTimeout = setTimeout(startRound, 1800);
}

function mousePressed() {
  // Handle action menu close button
  if (
    showActionMenu &&
    mouseX > actionMenuX + actionMenuWidth - 40 &&
    mouseX < actionMenuX + actionMenuWidth - 10 &&
    mouseY > 10 &&
    mouseY < 40
  ) {
    showActionMenu = false;
    return;
  }

  // Handle action card selection in menu
  if (
    showActionMenu &&
    mouseX > actionMenuX &&
    mouseX < actionMenuX + actionMenuWidth
  ) {
    for (let i = 0; i < playerActionCards.length; i++) {
      let cardY = 80 + i * (actionCardHeight + 20);
      let cardX = actionMenuX + (actionMenuWidth - actionCardWidth) / 2;

      if (
        mouseX > cardX &&
        mouseX < cardX + actionCardWidth &&
        mouseY + actionMenuScrollY > cardY &&
        mouseY + actionMenuScrollY < cardY + actionCardHeight
      ) {
        useActionCard(i);
        return;
      }
    }
    return;
  }

  // Regular game controls when menu isn't showing
  if (gameState !== "playerTurn" || mouseX > actionMenuX || isMobile) {
    return;
  }

  if (mouseButton === LEFT) {
    if (tempHints.length < 1) {
      tempHints.push(["Hit?", 1]); // text, opacity
    } else if (tempHints[0][0] === "Hit?") {
      tempHints.push(["Hit!", 1]); // text, opacity
      playerHit();
    }
  } else if (mouseButton === RIGHT) {
    if (tempHints.length < 1) {
      tempHints.push(["Stand?", 1]); // text, opacity
    } else if (tempHints[0][0] === "Stand?") {
      tempHints.push(["Stand!", 1]); // text, opacity
      playerStand();
    }
  }
}
function touchStarted() {
  touchX = mouseX;
  touchY = mouseY;
  mousePressed();
}
function touchMoved() {
  if (mouseX > actionMenuX && mouseY < height - 80) {
    actionMenuScrollY = touchY - mouseY;
  }
}

function mouseWheel(event) {
  if (showActionMenu) {
    let visibleHeight = height - 100;
    let totalCardsHeight = playerActionCards.length * (actionCardHeight + 20);
    let maxScroll = Math.max(0, totalCardsHeight - visibleHeight);
    actionMenuScrollY += event.delta;
    actionMenuScrollY = Math.max(0, Math.min(actionMenuScrollY, maxScroll));
    return false; // Prevent page scroll
  }
}

function keyPressed() {
  // Toggle action menu with space bar
  if (key === " " && gameState === "playerTurn") {
    showActionMenu = !showActionMenu;
  }

  // For testing - press 'n' to start a new game
  if ((key === "n" && gameState === "betting") || gameState === "gameOver") {
    newGame();
  }
}

function determineWinner() {
  if (gameState !== "gameOver") return; // Only determine winner at the end

  // Compare scores, closest to targetScore wins
  let deltaPlayerScore = abs(playerScore - targetScore);
  let deltaDealerScore = abs(dealerScore - targetScore);

  // Player busted previously (handled in playerHit)
  if (playerScore > targetScore && dealerScore <= targetScore) {
    message = "Bust! You lose.";
    return;
  }

  // Dealer busts
  if (dealerScore > targetScore && playerScore <= targetScore) {
    message = "Dealer Busts! You win!";
  } else if (deltaDealerScore > deltaPlayerScore) {
    // Dealer further away than player
    message = "You win!";
  } else if (deltaPlayerScore > deltaDealerScore) {
    message = "You lose.";
  } else {
    message = "Push! (Tie)";
  }

  console.log("Game Over:", message);
}
