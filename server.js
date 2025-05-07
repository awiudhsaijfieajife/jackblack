// Minimal Express + Socket.IO server
const express = require("express");
const http = require("http");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: ["http://localhost:3000"],
  },
});
let rooms = [];

// Serve static files from client/public
app.use(express.static(path.join(__dirname, "../client/public")));

// Start the server on port 3000
server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});

io.on("connection", socket => {
  console.log("A client connected:", socket.id);
  /*socket.onAny((event, args) => {
    console.log("Received event:", event, args);
  });*/

  socket.on("joinRoom", (room) => {
    //console.log("test");
    if(rooms[room] >=2 ) {
      socket.emit("error", `Room ${room} is full`);
      console.log(`Socket ${socket.id} tried to join full room ${room}`);
      return;
    }
    if (!rooms[room]) {
      socket.emit("error", `Room ${room} does not exist`);
      console.log(`Socket ${socket.id} tried to join non-existent room ${room}`);
      return;
    } else {
      rooms[room]++;
      socket.join(room);
      io.to(room).emit("joinedRoom", room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    }
  });

  socket.on("createRoom", (room) => {
    if (rooms[room]) {
      socket.emit("error", `Room ${room} already exists`);
      console.log(`Socket ${socket.id} tried to create existing room ${room}`);
    } else {
      rooms[room] = 1;
      socket.join(room);
      socket.emit("roomCreated", room);
      console.log(`Socket ${socket.id} created room ${room}`);
    }
  }
  );
  socket.on("startGame", (room) => {
    if (rooms[room] < 2) {
      socket.emit("error", `Not enough players in room ${room}`);
      console.log(`Socket ${socket.id} tried to start game in room ${room} with not enough players`);
      return;
    }
    console.log(`Socket ${socket.id} started game in room ${room}`);
    socket.to(room).emit("gameStarted", room);
    
  });
  socket.on("disconnect", () => {
    console.log("A client disconnected:", socket.id);
    for (const room in rooms) {
      if (rooms[room] > 0) {
        rooms[room]--;
        if (rooms[room] === 0) {
          delete rooms[room];
        }
      }
    }
  });
  //console.log("test2");
});




