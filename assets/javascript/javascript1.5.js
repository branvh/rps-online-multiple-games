// Initialize Firebase
let config = {
    apiKey: "AIzaSyArvv2-3JOsXNLmwayNJloyBIzQOTAacoA",
    authDomain: "rps-multiplayer-6b3b8.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-6b3b8.firebaseio.com",
    storageBucket: "rps-multiplayer-6b3b8.appspot.com",
    messagingSenderId: "991523280505"
};

//load DB and setup basic folder tree references from DB
firebase.initializeApp(config);
let db = firebase.database();
let userFolder = db.ref('/users/');
let lobbyFolder = db.ref('/lobby/');
let gameFolder = db.ref('/games/');
let user = '';
let opponent = '';

//create an anonymous user profile upon loading page
firebase.auth().signInAnonymously()
    .then(person => {

        //create a new user record in the userFolder
        user = person.uid;

        let newFolder = db.ref('/users/' + user);

        newFolder.set({

            userID: user,
            loginStatus: true,
            opponentID: '',
            currentGame: '',
            loginTime: firebase.database.ServerValue.TIMESTAMP

        })

        return person;
    })
    .then(() => {

        //check for child nodes in lobby, if there are none then add to lobby otherwise grab the oldest to be the opponen
        let query = lobbyFolder.orderByKey();

        query.once("value")
            .then(function(snapshot) {

                //if nobody is in the lobby, add the user to the lob
                if (!snapshot.val()) {

                    //setup new folder in the lobby
                    let newLobbyFolder = db.ref('/lobby/' + user);
                    newLobbyFolder.set({
                        userID: user,
                        timeAdded: firebase.database.ServerValue.TIMESTAMP
                    });

                    //add an event listener which will trigger game starting for lobby participant
                    db.ref('/users/' + user + '/currentGame').on('value', function(snapshot) {

                        console.log('adding ame listener for game ' + snapshot.val());
                        addGameListeners(snapshot.val());

                    });

                } else {
                    //grab first child from lobby
                    snapshot.forEach(function(childSnapshot) {

                        //set opponent to this value
                        opponent = childSnapshot.val().userID;

                        //remove opponent from lobby
                        db.ref('/lobby/' + opponent).remove();

                        //start the game
                        startGame(user, opponent);

                        // Cancel enumeration
                        return
                    });
                }
            });

    })
    .catch(e => {

        let errorCode = e.code;
        let errorMessage = e.message;
        console.log('Login error: ' + errorMessage);

    });


function startGame(user, opponent) {

    let newGame = '';
    let currentGame = '';

    db.ref('/users/' + user + '/currentGame').once('value').then(snapshot => {

        currentGame = snapshot.val();
        console.log('snapshot of db current game is ' + snapshot.val());

    }).then(() => {

        //check to see if assigned a current game, if not, create one and update opponent's info
        if (!currentGame) {

            newGame = makeNewGame(user, opponent);

            //update the user's folder
            db.ref('/users/' + user + '/currentGame') = newGame;
            db.ref('/users/' + user + '/opponentID') = opponent;
            //update the opponent's folder, which will also trigger the event listener to start their game
            db.ref('/users/' + opponent + '/currentGame') = newGame;
            db.ref('/users/' + opponent + '/opponentID') = user;

            addGameListeners();
        }

    }).then(() => {

        //add event listener based on start game value changing
        //only the 1st joiner of a game receives their game logic listener this way
        //second joiner receives game logic via the 'else' path from the 2nd 'then' claus of anonymous login
        gameFolder.child(newGame).on('value', function(snapshot) {

            //this won't work - need based on ids not p1/p2
            let userChoice = snapshot.val().p1RPS;
            let opponentChoice = snapshot.val().p2RPS;

            if (userChoice && oppontChoice) {
                gameLogic(userChoice, oppontChoice);
            }

        });


    }).catch(e => {

        console.log('error starting new game: ' + e);

    });

}

function makeNewGame(user, opponent) {

    //get reference ID for new game folder location
    let newGame = gameFolder.push();

    //make sub-folders for game management
    newGame.set({

        p1status: '',
        p2status: '',
        p1ID: user,
        p2ID: opponent,
        p1RPS: '',
        p2RPS: '',
        p1wins: 0,
        p2wins: 0,
        startTime: firebase.database.ServerValue.TIMESTAMP,
        p1replay: true, //default the replay choice to true to make replays happen
        p2replay: true

    });

    //pass back game folder key name to calling function for tracking purposes
    return newGame;

}

function gameLogic(snapshot) {

    //snapshot isn't getting passed...
    console.log('game logic function called with ' + snapshot.val());



}

function evaluate(diff) {

    //tie
    if (diff === 0) return 0;
    //wins
    else if (diff === -1 || diff === -2) return 1;
    //losses
    else return 2;
}

/*
ensure that both user and particpant have a listener applied
    set one player to p1 (the one who was not in lobby) and second to p2

add all functions to a game prototype?

add event listeners for status message - based on GAME folder

    waiting for another opponent to join (e.g. in lobby) <--while in lobby only, n/a game folder
    waiting for your choice
    turn in progress (while evaluation going on)



*/
