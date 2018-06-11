

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions


const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const request = require('request');
const cheerio = require('cheerio');
const async = require('async');

var database = admin.database();


exports.addList = functions.https.onRequest((req, res) => {
  // Grab the text parameter.
  const uid = req.query.uid;
  const link = req.query.link;
  var now = new Date();
  return requestList(link, uid, now.toJSON()).then((result) => {
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
      requestList(elem.val().link, elem.val().uid, elem.val().time);
    });
    return true;
  }).then(() => {
    return res.status(200).send('Retry Wait List\n');
  });
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
    if (snapshot.val() !== null){
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
    if (snapshot.val() !== null){
      userListData["name"] = lname;
      database.ref('/users/' + uid + "/" + lid).set(userListData);
      console.log("setUserListName - OK");
      return res.status(200).send("OK");
    } else{
      console.log("setUserListName - 404");
      return res.status(404).send("List not Found");
    }
  }).catch(() => {
    console.log("setUserListName - ERROR");
    return res.status(500).send("ERROR");
  });
});


exports.updateBestMarkets = functions.database.ref('/users/{pushId}/{list}')
  .onWrite((snapshot) => {
    if (snapshot.after.exists()){
      [list, price] = getList(snapshot.after);
      if (list.length > 0) {
        return getBestMarket(list, price).then((result) => {
          console.log("updateBestMarket - OK");
          return snapshot.after.ref.child('bestMarkets').set(result);
        }, (err) => {
          console.log("updateBestMarket - 404");
          return err;
        });
      } else {
        console.log("updateBestMarket - EmptyList");
        return new Error("Error - EL");
      }
    } else {
      console.log("updateBestMarket - RemovedList");
      return new Error("Error - LR");
    }
    
  });



function requestList(link, uid, date) {
  return new Promise( (resolve, reject) => {
    request(link, (error, response, html) => {
      if (!error) {
        let doc = cheerio.load(html);
        var lid = link.split('=')[1].split('&')[0];
        // NFe not available
        if (doc('xNome').text() === "") {
          waitElement = {
            uid: uid,
            link: link,
            time: date
          };
          return database.ref('/waitList/' + lid).set(waitElement).then(() => {
            console.log("requestList - NFe 404! Link on Wait List.");
            return resolve("NFe 404 - " + uid + " - "+ lid);
          })
        } else {
          var prodName = [];
          var prod = {};
          doc('xProd').each(function (i, element) {
            prodName[i] = doc(this).text().replace(/\.|#|\[|\]|\/|&|\*|%/g, " ")
            prod[prodName[i]] = {
              qtd: 0
            };
          });
          doc('cProd').each(function (i, element) {
            (prod[prodName[i]])["code"] = doc(this).text();
          });
          doc('uCom').each(function (i, element) {
            (prod[prodName[i]])["un"] = doc(this).text();
          });
          doc('qCom').each(function (i, element) {
            (prod[prodName[i]])["qtd"] += parseFloat(parseFloat(doc(this).text()).toFixed(3));
          });
          doc('vUnCom').each(function (i, element) {
            (prod[prodName[i]])["priceUnit"] = parseFloat(parseFloat(doc(this).text()).toFixed(3));
          });
          var price = 0;
          async.forEach(Object.keys(prod), (i, element) => {
            price += prod[i]["qtd"] * prod[i]["priceUnit"];
          });
          var address = {
            street: doc('xLgr').text(),
            num: doc('nro').text(),
            neighborhood: doc('xBairro').text(),
            city: doc('xMun').text(),
            // cod_city: doc('cMun').text(),
            uf: doc('UF').text(),
            cep: doc('CEP').text(),
            // cod_country: doc('cPais').text(),
            country: doc('xPais').text(),
            // phone: doc('fone').text(),
          };

          metadata = {
            name: doc('xNome').text(),
            cnpj: doc('CNPJ').text(),
            address: address,
            price: parseFloat(price.toFixed(3)),
            prod: prod,
            date: doc('dhRecbto').text(),
            link: link
          };

          return saveList(uid, lid, metadata).then((result) => {
            return resolve(result);
          }, (err) => {
            return reject(err);
          });
        }
      } else { // Error detected
        console.log("requestList - Error of Request");
        return reject(error);
      }
    });
  });
}

function saveList(uid, lid, metadata) {
  return new Promise((resolve, reject) => {
    var userListData = {
      cnpj: metadata.cnpj,
      name: metadata.name,
      prod: metadata.prod,
      address: metadata.address,
      date: metadata.date,
      price: metadata.price
    };
    var marketInfo = {
      name: metadata.name,
      address: metadata.address,
      date: metadata.date
    };
    var marketProd = {};
    async.forEach(Object.keys(metadata.prod), (i, element) => {
      marketProd[i] = {        
        code: metadata.prod[i].code,
        priceUnit: metadata.prod[i].priceUnit,
        un: metadata.prod[i].un
      }
    });   

    database.ref('/users/' + uid + "/" + lid).set(userListData);
    database.ref("/markets/" + metadata.cnpj + "/prod/").update(marketProd);
    database.ref("/markets/" + metadata.cnpj).update(marketInfo);
    database.ref('/waitList/' + lid).remove();

    return database.ref('/products/').once('value').then( (snapshot) => {
      var listProd = {};
      async.forEach(Object.keys(metadata.prod), (i, element) => {
        var markets = {};
        if (snapshot.val() !== null){
          if(snapshot.val()[i]) {
            markets = snapshot.val()[i];
          }
        }
        markets[metadata.cnpj] = true;
        listProd[i] = markets;
      });
      console.log("saveList - NFe OK!");
      userListData["lid"] = lid;
      resolve(userListData);
      return database.ref("/products/").update(listProd);
    });
  });
}

function objNotEmpty(obj){
  for (var i in obj) return true;
  return false;
}

function getBestMarket(list, price) {
  return new Promise((resolve, reject) => {
    return database.ref('markets/').once('value').then(snap => {
      var bestMarkets = {};
      var marketPrice = 0;
      // For each market on DB
      snap.forEach( (market) => {
        marketPrice = 0;
        var marketList = market.val().prod;
        // For each product on the list
        list.forEach( (listProduct) => {
          if(marketList[listProduct.name])
          {
            marketPrice += marketList[listProduct.name].priceUnit * listProduct.qtd;
          }
          else{
            marketPrice = -Infinity;
          }
        });
        marketPrice = parseFloat(marketPrice.toFixed(3));
        if(marketPrice >= 0)
        {
          bestMarkets[market.key] = {
            price: marketPrice,
            name: market.val().name
          };
        }
      });
      if (objNotEmpty(bestMarkets)) {
        return resolve(bestMarkets);
      } else {
        return reject(new Error("404"));
      }
    });
  });
}

function getList(snapshot){
  var prod = snapshot.val().prod;
  var list = [];
  var price = 0.0;
  price = snapshot.val().price;
  async.forEach(Object.keys(prod), (i, element) => {
    list.push({
      name: i,
      qtd: prod[i]["qtd"]
    })
  });
  return [list,price];
}
