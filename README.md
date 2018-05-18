# anota-server
Server for Anota, an application for creating automatic lists.

#### Prerquisites
1. Install the latest [Node.JS](https://nodejs.org/en/)
2. Install the [npm](https://www.npmjs.com)

### Installing Firebase
####To install from scratch:
1. `npm install firebase-functions@latest firebase-admin@latest --save`
2. `npm install -g firebase-tools`
####To install from this git project:
1. Go to the `project folder/functions`
2. Type: `npm install`
####Configuring project:
1. On terminal type: `firebase login`
2. Follow the steps to login on firebase (with your firenase account)
3. Go to the project folder.
4. Type: `firebase init`
5. Select `Functions` and `Database`.

#### Coding and Testing
1. The functions are coded on `functions/index.js`
2. To teste you can type: `firebase serve`
This is faster, and run the functions locally, this prevent from erros that can charge \$_$
3. The terminal will show an URL HTTP that you need to use for testing, example:
`http://localhost:5000/anota-backend/us-central1/addList?uid=12345&link=http://nfce...`
4. After testing everything you can deploy by: `firebase deploy`.
5. The terminal will also print an URL HTTP that you need to use for acessing the functions on the Firebase, example:
`https://us-central1-anota-backend.cloudfunctions.net/addList?uid=12345&link=http://nfce...`

> [Examples of Firebase Functions](https://github.com/firebase/functions-samples)

> [Firebase Functions Documentation](https://firebase.google.com/docs/functions/)






