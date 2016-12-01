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
let RPS = ['Rock', 'Paper', 'Scissors'];
let roundOutcome = ['Tie', 'You won this round!', 'You lost this round'];
let gameID = '';
let turn = 0;
//use these variables to determine who is p1 / p2
let you, them = '';

$(document).ready(function() {

    //ensure that play again modal and user turns box hidden until game starts
    $('#play-again-box').hide();
    $('#exit-game-box').hide();
    $('#selection-menu').hide();
    $('tbody').empty();

    //hide entire page and display a 'waiting for opponent' message?
    $('#lobby-message').show();

    //handle user's decision to replay
    $('#play-again').on('click', function() {

        //hide the play again modal
        $('#play-again-box').hide();

        //??what to do if user just doesn't decide for awhile...

        //prevent page reload
        return false;
    });

    //handle user's decision to quit
    $('#quit').on('click', function() {

        //hide the play again modal
        $('#play-again-box').hide();

        //end the game
        gameFolder.child(gameID).update({

            p1replay: false, //if one player quits, they both quit
            p2replay: false //exit game routine called via the event listner attached to these sub-folder elements

        });

        //prevent page reload
        return false;
    });

})

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

        // return person;
    })
    .then(() => {

        //join a game
        joinGame();

    })
    .catch(e => {

        let errorCode = e.code;
        let errorMessage = e.message;


    });

function joinGame() {


    //check for child nodes in lobby, if there are none then add to lobby otherwise grab the oldest to be the opponen
    let query = lobbyFolder.orderByKey();
    $('#play-again-box').hide();
    $('#exit-game-box').hide();

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

                    //add game listener if there is a game value - triggering gameplay for this path
                    if (snapshot.val()) {
                        //assign ID to ensure that user linked to proper game via this path
                        gameID = snapshot.val();
                        addGameListeners();
                    }

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

}


function startGame(user, opponent) {

    let newGame = '';
    let currentGame = '';

    db.ref('/users/' + user + '/currentGame').once('value').then(snapshot => {

        currentGame = snapshot.val();


    }).then(() => {

        //check to see if assigned a current game, if not, create one and update opponent's info
        if (!currentGame) {

            newGame = makeNewGame(user, opponent);

            //update the user's folder
            db.ref('users/' + user).update({

                currentGame: newGame,
                opponentID: opponent

            });
            //update the opponent's folder, which will also trigger the event listener to start their game
            db.ref('users/' + opponent).update({

                currentGame: newGame,
                opponentID: user

            });

            //add game logic listeners- other participant receives via login flow - if not in lobby
            addGameListeners(newGame);
        }

    }).catch(e => {

        console.log('error starting new game: ' + e);

    });

}

function makeNewGame(user, opponent) {

    //get reference ID for new game folder location
    let newGame = gameFolder.push().key;

    //assign global var of gameID
    gameID = newGame;

    //make sub-folders for game management
    gameFolder.child(gameID).set({

        p1status: '',
        p2status: '',
        p1ID: user, //won't get overwritten as only one player calls mkeNewGame
        p2ID: opponent,
        p1RPS: '',
        p2RPS: '',
        p1wins: 0,
        p2wins: 0,
        winner: '',
        p1message: '',
        p2message: '',
        startTime: firebase.database.ServerValue.TIMESTAMP,
        p1replay: true, //default the replay choice to true to make replays happen
        p2replay: true

    });

    //pass back game folder key name to calling function for tracking purposes
    return newGame;

}

function addGameListeners() {

    //remove lobby modal
    $('#lobby-message').hide();

    //reveal seleciton menu
    $('#selection-menu').show();

    gameFolder.child(gameID).once('value', function(snapshot) {

        if (snapshot.val().p1ID === user) {
            you = 'p1';
            them = 'p2';
        } else {
            you = 'p2';
            them = 'p1';
        }


        //add 'them' event listeners once them is defined...
    }).then(() => {

        //opponent replay listener
        gameFolder.child(gameID + '/' + them + 'replay').on('value', function(snapshot) {

            $('#exit-game-box').hide();

            //exit game if opponent elects not to replay
            if (snapshot.val() === false) {
                console.log('calling exit from replay listener');
                exitGame();
            }

        });

        gameFolder.child(gameID + '/' + them + 'message').on('value', function(snapshot) {

            //listen for opponent's messages and display them
            //user messages are auto-displayed via the sendChatMessage function
            displayChatMessage(snapshot.val(), them);

        });

        //rest of flow added in next then to avoid you / them assignnmet issues
    }).then(() => {

        //game choice event listener - to evaluate choices
        gameFolder.child(gameID).on('value', function(snapshot) {

            //if both players have chosen, evaluate their response
            //responses will be cleared out after game logic flow finishes
            let userChoice = snapshot.val()[you + 'RPS'];
            let opponentChoice = snapshot.val()[them + 'RPS'];
            let userWins = parseInt(snapshot.val()[you + 'wins']);
            let opponentWins = parseInt(snapshot.val()[them + 'wins']);

            if (userChoice && opponentChoice) {
                //only show opponent's choice if both players have made a selection
                //display choices in the choice panels of DOM
                $('#user-message').html('They picked ' + RPS[userChoice]);
                $('#opponent-message').html('They picked ' + RPS[opponentChoice]);
                gameLogic(userChoice, opponentChoice, userWins, opponentWins);
            }

            //update user status messages
            if (!userChoice && opponentChoice) {
                $('#user-message').html('Waiting for your choice');
                $('#opponent-message').html('Opponent made a selection');
            } //other scenario of you picked and opponent picked happens upon clicking on user selection


            //update user status messages
            if (userChoice && !opponentChoice) {
                $('#user-message').html('You picked ' + RPS[userChoice]);
                $('#opponent-message').html('Waiting for opponent');
            }
            //update user status messages
            if (!userChoice && !opponentChoice) {
                $('#user-message').html('Waiting for your choice');
                $('#opponent-message').html('They also haven\'t selected');
            }

        });

        //wins game listener
        gameFolder.child(gameID).child('winner').on('value', function(snapshot) {

            //call end of game function
            if (snapshot.val()) {
                endOfGame();
            }

        });

        //disconnect variables
        let opponentConnection = db.ref('/users/' + opponent);
        let userConnection = db.ref('/users/' + user);
        let connectedRef = firebase.database().ref('/.info/connected');

        //opponent disconnect listener
        opponentConnection.on('value', function(info) {

            if (info.val() === false) {
                //run opponent disconnected function
                $('#status-message').html('Opponent disconnected, returning to lobby if they don\'t return soon');

                //in 5 seconds, check to see if opponent has returned and, if not, exit game
                setTimeout(function() {

                    opponentConnection.once('value', function(status) {

                        //check to see if opponent still disconnected
                        if (status.val() === false) {
                            exitGame();
                        } else {
                            //clear out message and continue gameplay
                            $('#status-message').html('');

                        }

                    });

                }, 4000);

            }

        });

        //update user status upon disconnect
        connectedRef.on('value', function(info) {

            if (info.val()) {
                userConnection.onDisconnect().update({ loginStatus: false });
                userConnection.update({ loginStatus: true });
            }

        });

        //add event listener to capture user selection
        //click listener to set user choice and drive gameplay function - MUST ADD AFTER YOU/THEM DEFINED OR ERRORS RESULT
        $('.selection').on('click', function() {

            let userChoice = $(this).attr('data-pointVal');

            //create an update to update selection in the DB
            let selection = {};
            let player = you + 'RPS';
            selection[player] = userChoice;

            //update DB with user selection by sending the data-pointVal of selected item
            gameFolder.child(gameID).update(selection);

            //update the user's status to reflect that they are playing - turn underway
            updateUserStatus('playing');

            //hide choice bar
            $('#selection-menu').hide();

            //clear out old choices in DOM user/opponent choice boxes
            $('#user-message').html('You picked ' + RPS[userChoice]);
            $('#opponent-message').html('Waiting for opponent to pick');

            //prevent page reload
            return false;

        });

        //chat message event listener, to update chat window
        $('#chat-submit').on('click', function() {

            //message content
            let message = $('#chat-entry').val().trim();

            //empty the user's text box
            $('#chat-entry').val('');

            //update the DB with chat message, which then triggers function to render chat message
            sendChatMessage(message);

            //prevent page reload
            return false;

        });


    }).catch(e => {

        console.log('error assigning player ids: ' + e);

    });


}

function updateUserStatus(status) {

    //create an update to update the status in the DB
    let selection = {};
    let player = you + 'status';
    selection[player] = status;

    //set status of user - you - based on value passed to it
    gameFolder.child(gameID).update(selection);

}

function gameLogic(userChoice, opponentChoice, userWins, opponentWins) {

    //evaluate responses
    let diff = parseInt(userChoice - opponentChoice);
    let result = evaluate(diff);
    let userPointPath = gameFolder.child(gameID + '/' + you + 'wins');
    let message = roundOutcome[result];
    userWins = parseInt(userWins);
    opponentWins = parseInt(opponentWins);

    //update the game log at bottom of user's screen
    updateGameLog(userChoice, opponentChoice, result);

    //reset the RPS choices for next round
    nextTurn();

    //update points by 1 upon user win only
    if (result === 1) {
        userWins++;

        //create object to update DB
        let updatedWins = {};
        let player = you + 'wins';
        updatedWins[player] = userWins;

        gameFolder.child(gameID).update(updatedWins);

    } else if (result === 2) {

        opponentWins++;
    }

    //update user status game dipslay status 0 = tie, 1 = you win, 2= you lost round
    $('#user-message').html(message);
    $('#opponent-message').html('');

    //update the wins items in DOM
    updateWins(userWins, opponentWins);

    //empty out messages if opponent is about to win; game end function taken care of via event listener on winner subfolder of game folder
    if (opponentWins === 3) {
        $('#user-message').html('');
        $('#opponent-message').html('');
    }

    //determine if winner and, if so, update winner field which will trigger win game listener above
    if (userWins === 3) {

        $('#user-message').html('');
        $('#opponent-message').html('');

        //momentarily wait to trigger win-game protocol
        setTimeout(function() {
            gameFolder.child(gameID).update({ winner: user });
        }, 3000);

    }

    //update turn status message - give user a chance to see if they won/lost
    setTimeout(function() {
        $('#user-message').html('Please make next selection');
        $('#opponent-message').html('Waiting for opponent');

        //unhide choice bar
        $('#selection-menu').show();

    }, 3000);

}

function evaluate(diff) {

    //tie
    if (diff === 0) return 0;
    //wins
    else if (diff === 1 || diff === -2) return 1;
    //losses
    else return 2;

}

function updateGameLog(userRPS, opponentRPS, result) {

    turn++;

    let newRow = $('<tr>');
    newRow.addClass('info');

    let turnTD = $('<td>');
    turnTD.html(turn);

    let userChoice = $('<td>');
    userChoice.html(RPS[userRPS]);

    let opponentChoice = $('<td>');
    opponentChoice.html(RPS[opponentRPS]);

    let outcomeTD = $('<td>');
    outcomeTD.html(roundOutcome[result]);

    newRow.append(turnTD).append(userChoice).append(opponentChoice).append(outcomeTD);

    $('tbody').prepend(newRow);

}

function nextTurn() {

    gameFolder.child(gameID).update({

        p1RPS: '',
        p2RPS: '',

    });

}

function sendChatMessage(message) {

    //determine who sent message and create object to update the DB
    let newMessage = {};
    let player = you + 'message';
    newMessage[player] = message;

    gameFolder.child(gameID).update(newMessage);

    displayChatMessage(message, you);

}

function displayChatMessage(message, sender) {

    //don't render blank messages, such as when user first loads page and listener triggered via null value
    if (!message) return;

    //determine who is sending the message
    let messageSender = ((sender === you) ? 'You: ' : 'Them: ');

    let msg = $('<p>');
    msg.html('<strong>' + messageSender + '</strong>' + message);
    msg.addClass('chat-log');

    $('#chat-panel').append(msg);

    //ensure scroll stays at botom
    $("#chat-panel").animate({ scrollTop: $("#chat-panel")[0].scrollHeight }, 1);

}

function updateWins(userWins, opponentWins) {

    $('#user-wincount').html('Your wins: ' + userWins);
    $('#opponent-wincount').html('Their wins: ' + opponentWins);

}

function endOfGame() {

    //refresh gameplay fields
    gameFolder.child(gameID).update({

        p1status: '',
        p2status: '',
        p1RPS: '',
        p2RPS: '',
        p1wins: 0,
        p2wins: 0,
        winner: '',
        p1message: '',
        p2message: ''

    })

    //reset game turn
    turn = 0;

    //clear out user and opponent status boxes
    $('#user-message').html('');
    $('#opponent-message').html('');

    //empty win boxes
    $('#user-wincount').html('');
    $('#opponent-wincount').html('');

    //clear out game status boxes
    $('#status-message').html('');

    //clear out gamelog text
    $('tbody').empty();

    //display play again modal
    $('#play-again-box').show();

}

function exitGame() {
    console.log('in the exit function');
    $('#play-again-box').hide();
    $('#exit-game-box').show();

    //clear out user and opponent status boxes
    $('#user-message').html('');
    $('#opponent-message').html('');

    //empty win boxes
    $('#user-wincount').html('');
    $('#opponent-wincount').html('');

    //clear out game status boxes
    $('#status-message').html('');

    //clear out gamelog text
    $('tbody').empty();

    //empty the chat window
    $('#chat-panel').empty();
    setTimeout(function() {

            //hide this modal after a few seconds so that user knows what is going on
            $('exit-game-box').hide();

            //send user to lobby - show message, add them to lobby folder, remove event listeners
            $('#lobby-message').show();


            setTimeout(function() {

                //remove listeners from gameID folder
                gameFolder.child(gameID).off();
                db.ref('/users/' + opponent).off();
                gameFolder.child(gameID).child('winner').off();
                db.ref('/users/' + user + '/currentGame').off();

                //empty out user's current game assignment in their account id folder
                db.ref('/users/' + user).update({ currentGame: '' });

                //go back to lobby or start a new game if someone is available
                joinGame();


            }, 3000);
        }, 2000
    }


}
