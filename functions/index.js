

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

var async = require('async');
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const request = require('request');
const cheerio = require('cheerio');

exports.getBestMarkets = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;

  return admin.database().ref('/users/' + uid).once('value').then( (snapshot) => {
    return res.status(200).send(snapshot.val().bestMarkets);
  });

});

exports.addList = functions.https.onRequest((req, res) => {
    // Grab the text parameter.
    const uid = req.query.uid;
    const link = req.query.link;

    requestList(link, uid, Date.now(), res);
});

function requestList(link, uid, date, res) {
    request(link, (error, response, html) => {
        if (!error) {
            let doc = cheerio.load(html);

            var prodName = [];
            var prod = {};
            doc('xProd').each(function (i, element) {
                prodName[i] = doc(this).text();
                prod[prodName[i]] = {
                    // name: doc(this).text()
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

            metadata = {
                name: doc('xNome').text(),
                fantasyName: doc('xFant').text(),
                prod: prod,
                date: date
            };

            return saveList(uid, metadata, res);


        } else {
            console.log("request error");
            return error;
        }
    });    
}

function saveList(uid, metadata, res) {
    var listData = {
        name: metadata.name,
        prod: metadata.prod,
        date: metadata.date
    };

    var listProd = metadata.prod;
    async.forEach(listProd, (i, element) => {
        (i)["market"] = metadata.fantasyName;
    });    
    return admin.database().ref('/users/' + uid + "/" + metadata.fantasyName).set(listData).then(() => {
        return admin.database().ref('/markets/' + metadata.fantasyName).update(listData);    
    }).then(() => {
        return admin.database().ref('/products').update(listProd);
    }).then(() => {
        return res.status(200).send("OK");
    });
}
//Teste Local
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180421920821000116650050000111779051519177&nVersao=100&tpAmb=1&dhEmi=323031382D30342D32345431343A33343A31342D30333A3030&vNF=68.23&vICMS=3.17&digVal=&cIdToken=000001&cHashQRCode=BFFC6C762A27D77FF8C8B8FDB6B83C6296F6014F
//http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?chNFe=26180406057223027967650100000196741100418351&nVersao=100&tpAmb=1&dhEmi=323031382d30342d32395431303a32333a34322d30333a3030&vNF=663.96&vICMS=71.81&digVal=2f4e314952456f7149353159793352596972627664654e78574a413d&cIdToken=000001&cHashQRCode=3957073cfcd84f6ebb36718f179b3f65cf38f881

// Listens for new messages added to /messages/:pushId/original and creates an
// uppercase version of the message to /messages/:pushId/uppercase
// exports.makeUppercase = functions.database.ref('/messages/{pushId}/original')
//     .onCreate((snapshot, context) => {
//         // Grab the current value of what was written to the Realtime Database.
//         const original = snapshot.val();
//         console.log('Uppercasing', context.params.pushId, original);
//         const uppercase = original.toUpperCase();
//         // You must return a Promise when performing asynchronous tasks inside a Functions such as
//         // writing to the Firebase Realtime Database.
//         // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
//         return snapshot.ref.parent.child('uppercase').set(uppercase);
//     });

//  





