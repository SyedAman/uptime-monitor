const data = require('../data');
const helpers = require('../helpers');

const user = ({method, trimmedPath, ...dataToHandle}, callback) => {
  const supportedMethods = ['POST', 'GET', 'PUT', 'DELETE'];
  if (!supportedMethods.includes(method)) callback(new Error(`HTTP method ${method} is not supported for /${trimmedPath}!`), 405);
  userHandlersByMethod[method](dataToHandle, callback);
}

const userHandlersByMethod = {
  // Required payload: firstName, lastName, phone, password, isTosAgreement.
  // Optional payload: none.
  POST: ({payload}, callback) => {
    const trimmedPayload = helpers.trimObject(payload);
    const {firstName, lastName, phone, password, tosAgreement} = trimmedPayload;
    // Validate required fields.
    // @TODO: Improve this by letting the requester know which part of the body
    // is invalid by converting this into an object of validations.
    const isFirstNameValid = firstName && typeof firstName === 'string';
    const isLastnameValid = lastName && typeof lastName === 'string';
    const isPhoneValid = helpers.validatePhoneNumber(phone);
    const isPasswordValid = password && typeof password === 'string';
    const isTosAgreementValid = tosAgreement && typeof tosAgreement === 'boolean';
    const validators = [isFirstNameValid, isLastnameValid, isPhoneValid, isPasswordValid, isTosAgreementValid];
    if (validators.some(validator => !validator)) return callback(new Error('Missing or invalid required fields!'), 400);
    // Verify for duplicate users.
    data.read('users', phone, (err, fileData) => {
      if (!err) return callback(new Error(`User with phone # ${phone} already exists!`), 400);
      const newUser = {
        firstName,
        lastName,
        phone,
        tosAgreement
      };
      // hash the password
      const hashedPassword = helpers.hash(password);
      data.create('users', phone, {...newUser, hashedPassword}, err => {
        if (err) callback(new Error(`Failed to create user ${firstName} ${lastName}.`), 500);
        callback(null, 200, newUser);
      })
    })
  },
  // @TODO: Only let authenticated users access their own user file/information. Prevent from access others'.
  GET: ({ query: { phone } }, callback) => {
    // Validate query parameters.
    const isPhoneValid = helpers.validatePhoneNumber(phone);
    if (!isPhoneValid) return callback(new Error(`The phone query parameter ${phone} is not valid!`), 400);
    data.read('users', phone, (err, fileData) => {
      if (err) callback(new Error(`Could not find user with phone number ${phone}!`), 404);
      const parsedFileData = JSON.parse(fileData);
      // Make sure we're not sending the user password information that is both useless and insecure.
      delete parsedFileData.hashedPassword;
      callback(null, 200, parsedFileData);
    });
  },
  // @TODO: Only let authenticated users update their own user file/information. Prevent from access others'.
  PUT: ({ payload: { firstName, lastName, phone, password } }, callback) => {
    data.read('users', phone, (err, fileData) => {
      const isPhoneValid = helpers.validatePhoneNumber(phone);
      if (!isPhoneValid) return callback(new Error(`The phone query parameter ${phone} is not valid!`), 400);
      if (err) callback(new Error(`Could not find user with phone number ${phone}!`), 404);
      // Validate optional fields.
      let validators = [];
      if (firstName) validators.push(helpers.validateName(firstName));
      if (lastName) validators.push(helpers.validateName(lastName));
      if (password) validators.push(helpers.validatePassword(password));
      if (validators.some(validator => !validator)) return callback(new Error('Missing or invalid required fields!'), 400);
      let updatedFile = JSON.parse(fileData);
      updatedFile = {
        ...updatedFile,
        firstName: firstName ? firstName : updatedFile.firstName,
        lastName: lastName ? lastName : updatedFile.lastName,
        hashedPassword: password ? helpers.hash(password) : updatedFile.hashedPassword,
      };
      // Update user store.
      data.update('users', phone, updatedFile, err => {
        if (err) callback(new Error(`Failed to update user with phone number ${phone}!`), 500);
        // Make sure we're not sending the user password information which is both useless and insecure.
        delete updatedFile.hashedPassword;
        callback(null, 200, updatedFile);
      })
    });
  },
  // @TODO: Only let authenticated users delete their own user file/information. Prevent from access others'.
  // @TODO: Cleanup (delete) related data.
  // Delete users.
  DELETE: ({ query: { phone } }, callback) => {
    const isPhoneValid = helpers.validatePhoneNumber(phone);
    if (!isPhoneValid) return callback(new Error(`The phone query parameter ${phone} is not valid!`), 400);
    data.read('users', phone, (err, fileData) => {
      if (err) callback(new Error(`Could not find user with phone number ${phone}!`), 404);
      data.delete('users', phone, err => {
        if (err) return callback(new Error(`Failed to delete user with phone number ${phone}!`), 500);
        callback(null, 200, { message: `Successfully deleted user with phone number ${phone}.` });
      });
    });
  }
};

module.exports = user;
