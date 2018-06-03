

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


exports.updateBestMarkets = functions.database.ref('/users/{pushId}/{market}')
  .onCreate((snapshot, context) => {
    [list, price] = getList(snapshot);
    getBestMarket(list, price, snapshot);
    return true;
  });


  //Teste Local
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180421920821000116650050000111779051519177&nVersao=100&tpAmb=1&dhEmi=323031382D30342D32345431343A33343A31342D30333A3030&vNF=68.23&vICMS=3.17&digVal=&cIdToken=000001&cHashQRCode=BFFC6C762A27D77FF8C8B8FDB6B83C6296F6014F
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180406057223027967650100000196741100418351&nVersao=100&tpAmb=1&dhEmi=323031382d30342d32395431303a32333a34322d30333a3030&vNF=663.96&vICMS=71.81&digVal=2f4e314952456f7149353159793352596972627664654e78574a413d&cIdToken=000001&cHashQRCode=3957073cfcd84f6ebb36718f179b3f65cf38f881



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
            prodName[i] = doc(this).text().replace(/\/|&|\*|%/g, " ");
            prod[prodName[i]] = {
              //name: doc(this).text()
            };
          });
          doc('cProd').each(function (i, element) {
            (prod[prodName[i]])["code"] = doc(this).text();
          });
          doc('uCom').each(function (i, element) {
            (prod[prodName[i]])["un"] = doc(this).text();
          });
          doc('qCom').each(function (i, element) {
            (prod[prodName[i]])["qtd"] = doc(this).text();
          });
          doc('vUnCom').each(function (i, element) {
            (prod[prodName[i]])["priceUnit"] = doc(this).text();
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
        reject(error);
        return error;
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
      date: metadata.date
    };
    var marketInfo = {
      name: metadata.name,
      address: metadata.address,
      date: metadata.date
    };

    database.ref('/users/' + uid + "/" + lid).set(userListData);
    database.ref("/markets/" + metadata.cnpj + "/prod/").update(metadata.prod);
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
      return database.ref("/products/").update(listProd);
    }).then(() => {
      console.log("saveList - NFe OK!");
      userListData["lid"] = lid;
      return resolve(userListData);
    });
  });
}

function objNotEmpty(obj){
  for (var i in obj) return true;
  return false;
}

function getBestMarket(list, price, snapshot) {
  var bestMarkets = {};
  markets = database.ref('markets/').once('value').then(snap => {

    marketPrice = 0;
    snap.forEach( market => {

      marketPrice = 0;
      var haveAllProducts = true;
      var name = market.key;
      var prodFullList = market.val().prod;

      list.forEach( (targetProduct, index) =>{
        if(prodFullList[targetProduct.name])
        {
          marketPrice += prodFullList[targetProduct.name].priceUnit*targetProduct.qtd;
        }
        else{
          marketPrice = -Infinity;
        }
      });

      if(marketPrice >= 0)
      {
        bestMarkets[name] = {price: marketPrice, gps: -1};
      }
    });

    if(objNotEmpty(bestMarkets))
    {
      return snapshot.ref.child('bestMarkets').set(bestMarkets);
    }

    return true;
  });
  return markets;
}

function getList(snapshot){
  var prod = snapshot.val().prod;
  var list = [];
  var price = 0.0;
  if (prod)
  {
    for(var product in prod)
    {
      list.push({
        name: product,
        qtd: parseFloat(prod[product].qtd)
      });

      itemPrice = parseFloat(prod[product].priceUnit)*parseFloat(prod[product].qtd);
      price += itemPrice;
    }
  }

  return [list,price];
}
