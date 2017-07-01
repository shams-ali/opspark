'use strict';

var
  config = require('../config'),
  _ = require('lodash'),
  util = require('util'),
  Q = require('q'),
  fsJson = require('fs-json')(),
  changeCase = require('change-case'),
  async = require('async'),
  github = require('./github'),
  projects = require('./projects-copy'),
  program = require('commander'),
  inquirer = require('inquirer'),
  colors = require('colors'),
  fs = require('fs'),
  url = require('url'),
  exec = require('child_process').exec,
  request = require('request'),
  mkdirp = require('mkdirp'),
  rimraf = require('rimraf'),
  cancelOption = '[cancel]',
  rootDirectory = './',
  projectsDirectory = 'projects';
  projectEntriesPath = 'projects/projects.json';

module.exports.test = function() {
  const username = github.grabLocalLogin();
  console.log(username);
  // const installedProjects = projects.listProjectsOf(username);
  projects.listProjectsOf(username)
    .then(function (installedProjects) {
      projects.selectProject(installedProjects, grabTests, 'test');
    });
};

function grabTests(err, project) {
  console.log(`Downloading tests for ${project}. . .`);
  // TODO: swap livrush to opspark
  const uri = `https://github.com/livrush/${project}`;
  // const uri = `https://github.com/OperationSpark/${project}`;
  const token = projects.grabLocalToken();
  // TODO: swap branches/test to trunk
  const cmd = `svn export ${uri} ${projectsDirectory}/${project}/branches/test/test --password ${token}`;
  // const cmd = `svn export ${uri} ${projectsDirectory}/${project}/trunk/test --password ${token}`
  exec(cmd, function (err, stdout, stderr) {
    if (err) return console.log(`There was an error. ${err}`);
    console.log('Successfully downloaded tests!'.green);
  });
}