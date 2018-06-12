

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions


const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const database = admin.database();
const aux = require("./auxiliar.js");


exports.addList = functions.https.onRequest((req, res) => {
  // Grab the text parameter.
  const uid = req.query.uid;
  const link = req.query.link;
  var now = new Date();
  return aux.requestList(link, uid, now.toJSON(), database).then((result) => {
    return res.status(200).send(result);
  }, (err) => {
    return res.status(500).send(err);
  });
});

exports.retryList = functions.https.onRequest((req, res) => {
  var wl = database.ref('/waitList/');
  return wl.once('value').then((snapshot) => {
    snapshot.forEach(elem => {
      // console.log(elem.key + " uid: " + elem.val().uid + " link " + elem.val().link + " and time: " + elem.val().time);
      aux.requestList(elem.val().link, elem.val().uid, elem.val().time);
    });
    return true;
  }).then(() => {
    return res.status(200).send('Retry Wait List');
  }).catch(() => {
    return res.status(500).send('Retry Wait Error');
  });
});

exports.updateBestMarkets = functions.database.ref('/users/{pushId}/{list}')
.onWrite((snapshot) => {
  if (snapshot.after.exists()){
    return aux.getBestMarket(snapshot.after, database).then((result) => {
      console.log("updateBestMarket - OK");
      return snapshot.after.ref.child('bestMarkets').set(result);
    }, (err) => {
      console.log("updateBestMarket - " + err.message);
      return err;
    });
  } else {
    console.log("updateBestMarket - RemovedList");
    return new Error("Error - LR");
  }
});

exports.getUser = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  return database.ref('/users/' + uid).once('value').then((snapshot) => {
    if (snapshot.val() !== null) {
      console.log("getUser - OK");
      return res.status(200).json(snapshot.val());
    } else {
      console.log("getUser - 404");
      return res.status(404).send("User not Found");
    }
  }).catch(() => {
    console.log("getUser - ERROR");
    return res.status(500).send("User Lists - ERROR");
  });
});

exports.getUserList = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  const lid = req.query.lid;
  return database.ref('/users/' + uid + "/" + lid).once('value').then((snapshot) => {
    if (snapshot.val() !== null) {
      console.log("getUserList - OK");
      return res.status(200).json(snapshot.val());
    } else {
      console.log("getUserList - 404");
      return res.status(404).send("List not Found");
    }
  }).catch(() => {
    console.log("getUserList - ERROR");
    return res.status(500).send("ERROR");
  });
});

exports.setUserListName = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  const lid = req.query.lid;
  const lname = req.query.lname;
  return database.ref('/users/' + uid + "/" + lid).once('value').then((snapshot) => {
    var userListData = snapshot.val();
    if (snapshot.val() !== null) {
      userListData["name"] = lname;
      database.ref('/users/' + uid + "/" + lid).set(userListData);
      console.log("setUserListName - OK");
      return res.status(200).send("OK");
    } else {
      console.log("setUserListName - 404");
      return res.status(404).send("List not Found");
    }
  }).catch(() => {
    console.log("setUserListName - ERROR");
    return res.status(500).send("ERROR");
  });
});

exports.removeUserList = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  const lid = req.query.lid;
  return database.ref('/users/' + uid + "/" + lid).remove().then(() => {
    console.log("removeUserList - OK");
    return res.status(200).send("OK");
  }).catch(() => {
    console.log("removeUserList - ERROR");
    return res.status(500).send("ERROR");
  });
});

exports.removeUserListProduct = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  const lid = req.query.lid;
  const product = req.query.prod;
  return database.ref('/users/' + uid + "/" + lid + "/prod").once("value").then((snapshot) => {
    if (product in snapshot.val()) {
      if(Object.keys(snapshot.val()).length <= 1){
        database.ref('/users/' + uid + "/" + lid).remove();
      } else {
       database.ref('/users/' + uid + "/" + lid + "/prod/" + product).remove();
      }
      console.log("removeUserListProduct - OK");
      return res.status(200).send("OK");
    } else {
      console.log("removeUserListProduct - 404");
      return res.status(500).send("Product 404");
    }
  }).catch(() => {
    console.log("removeUserListProduct - ERROR");
    return res.status(500).send("ERROR");
  });
});