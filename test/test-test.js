/* global describe it expect before beforeEach afterEach */
'use strict';

require('mocha');
require('should');
require('colors');
const fs = require('fs');
const _ = require('lodash');
const util = require('util');
const sinon = require('sinon');
const prompt = require('prompt');
const rimraf = require('rimraf');
const process = require('process');
const fsJson = require('fs-json')();
const expect = require('chai').expect;
const bddStdin = require('bdd-stdin');
const proxyquire = require('proxyquire');
const changeCase = require('change-case');

const fakeHelpers = require('./helpers/fakeHelpers');

const { dummySession, dummySessions, dummyTestPass, dummyTestFail } = require('./helpers/dummyData');

const projects = proxyquire('../controller/projects', {
  './env': {
    home: fakeHelpers.home,
  },
});

const test = proxyquire('../controller/test', {
  './helpers': fakeHelpers,
  './github': fakeHelpers,
  './env': {
    home: fakeHelpers.home,
  },
});

const projectsDirectory = './test/files/workspace/projects';
const projectEntriesPath = './test/files/workspace/projects/projects.json';

describe('test', function () {
  before(function (done) {
    rimraf(projectsDirectory, () => done());
  });

  describe('#grabTests()', function () {
    it('should install tests', function (done) {
      const project = dummySession.PROJECT[0];
      const name = changeCase.paramCase(project.name);
      const path = `${projectsDirectory}/${name}`;
      expect(fs.existsSync(`${path}/test`)).to.be.false;
      projects.ensureProjectsDirectory();
      fs.mkdirSync(path);
      fs.writeFileSync(`${path}/package.json`, '{}');
      test.grabTests(project)
        .then(function () {
          expect(fs.existsSync(`${path}/test`)).to.be.true;
          done();
        });
    });

    it('should install package.json if necessary', function (done) {
      const project = dummySession.PROJECT[1];
      const name = changeCase.paramCase(project.name);
      const path = `${projectsDirectory}/${name}`;
      expect(fs.existsSync(`${path}/package.json`)).to.be.false;
      projects.ensureProjectsDirectory();
      fs.mkdirSync(path);
      test.grabTests(project)
        .then(function () {
          expect(fs.existsSync(`${path}/package.json`)).to.be.true;
          done();
        });
    });
  });

  describe('#runTests()', function () {
    const log = sinon.spy(console, 'log');
    const project = dummySession.PROJECT[1];

    const passTests = proxyquire('../controller/test', {
      './helpers': {
        makeTestScript: fakeHelpers.makeTestPass,
      },
      './github': fakeHelpers,
      './env': {
        home: fakeHelpers.home,
      },
    }).runTests;

    const failTests = proxyquire('../controller/test', {
      './helpers': {
        makeTestScript: fakeHelpers.makeTestFail,
      },
      './github': fakeHelpers,
      './env': {
        home: fakeHelpers.home,
      },
    }).runTests;

    afterEach(function () {
      log.reset();
    });

    after(function () {
      log.restore();
    });

    it('should run tests and find pass', function (done) {
      passTests(project)
        .then(function (result) {
          const stats = result.parsedStdout.stats;
          expect(result.project).to.exist;
          expect(result.parsedStdout).to.exist;
          expect(stats.tests).to.equal(4);
          expect(stats.passes).to.equal(4);
          expect(stats.pending).to.equal(0);
          expect(stats.failures).to.equal(0);
          done();
        });
    });

    it('should run tests and find failure', function (done) {
      failTests(project)
        .then(function (result) {
          const stats = result.parsedStdout.stats;
          expect(result.project).to.exist;
          expect(result.parsedStdout).to.exist;
          expect(stats.tests).to.equal(4);
          expect(stats.passes).to.equal(0);
          expect(stats.pending).to.equal(0);
          expect(stats.failures).to.equal(4);
          done();
        });
    });

    it('should log correct stats', function (done) {
      passTests(project)
        .then(function (result) {
          const stats = result.parsedStdout.stats;
          expect(log.calledWith(' Total tests:    4  '.bgBlack.white)).to.be.true;
          expect(log.calledWith(' Passing tests:  4  '.bgBlue.white)).to.be.true;
          expect(log.calledWith(' Pending tests:  0  '.bgYellow.black)).to.be.true;
          expect(log.calledWith(' Failing tests:  0  '.bgRed.white)).to.be.true;
          done();
        });
    });

    it('should log correct stats', function (done) {
      failTests(project)
        .then(function (result) {
          const stats = result.parsedStdout.stats;
          expect(log.calledWith(' Total tests:    4  '.bgBlack.white)).to.be.true;
          expect(log.calledWith(' Passing tests:  0  '.bgBlue.white)).to.be.true;
          expect(log.calledWith(' Pending tests:  0  '.bgYellow.black)).to.be.true;
          expect(log.calledWith(' Failing tests:  4  '.bgRed.white)).to.be.true;
          done();
        });
    });
  });

  describe('#displayResults()', function () {
    it('should fail with failing results', function () {
      test.displayResults({ parsedStdout: JSON.parse(dummyTestFail) })
        .then(function ({ pass }) {
          expect(pass).to.be.false;
        });
    });

    it('should pass with passing results', function () {
      test.displayResults({ parsedStdout: JSON.parse(dummyTestPass) })
        .then(function ({ pass }) {
          expect(pass).to.be.true;
        });
    });
  });
});
