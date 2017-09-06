'use strict';

const _ = require('lodash');
const changeCase = require('change-case');
const github = require('./github');
const greenlight = require('./greenlight');
const projects = require('./projects');
const submit = require('./submit');
const fs = require('fs');
const colors = require('colors');
const exec = require('child_process').exec;
const env = require('./env');

const rootDirectory = `${env.home()}/workspace`;
const projectsDirectory = `${rootDirectory}/projects`;

// Start of test command
// Runs the listProjectsOf function from projects to select project
// that user wants to be tested
function test(options, submitFlag) {
  let action = 'test';
  if (submitFlag) {
    action = 'submit';
  }

  projects.chooseClass(action, function(session, action) {
    let projectsList = session.PROJECT;
    projectsList = findAvailableProjects(projectsList, session.sessionId).sort(function(a, b) {
      if (a.name < b.name)
        return -1;
      if (a.name > b.name)
        return 1;
      return 0;
    });

    projectsList.push(
      {
        _id: 'H5jymW66LEvSQRo4Q',
        _session: 'vJ3hbkCCwbei343Hz',
        name: 'Let\'s Get Functional',
        desc: 'An exercise in problem solving in the functional idiom',
        url: 'https://github.com/OperationSpark/lets-get-functional',
      },
      {
        _id: 'T5LMsegDbMaSr8Z9K',
        _session: 'vJ3hbkCCwbei343Hz',
        name: 'Portfolio Page',
        desc: 'Add a portfolio page to your website project',
        url: 'https://github.com/OperationSpark/portfolio'
      },
      {
        _id: 'Xe7HfMW7P5YipdZMc',
        _session: 'vJ3hbkCCwbei343Hz',
        name: 'First Website',
        desc: 'A client-side web project into which we\'ll install many projects',
        url: 'https://github.com/OperationSpark/first-website',
      }
    );

    projects.selectProject(projectsList, grabTests, action, submitFlag);
  });
}

module.exports.test = test;


// Takes in projectsList
// Creates mappedProjects, which is array of project names
// Creates files, which is list of currently installed project names
// Creates testableProjects, intersection of mappedProjects and files
// Reduces and returns original projectsList to be only those in intersection
function findAvailableProjects(projectsList, session) {
  const mappedProjects = _.map(projectsList, function (e) {
    return changeCase.paramCase(e.name);
  });
  const files = fs.readdirSync(projectsDirectory);
  const testableProjects = _.intersection(mappedProjects, files);
  return projectsList.reduce(function (seed, project) {
    if (testableProjects.indexOf(changeCase.paramCase(project.name)) > -1) {
      project._session = session;
      seed.push(project);
    }
    return seed;
  }, []);
}

module.exports.findAvailableProjects = findAvailableProjects;

// Runs svn export to download the tests for the specific project
// and places them in the correct directory
// Then calls setEnv
function grabTests(project, submitFlag) {
  const name = changeCase.paramCase(project.name);
  const repo = `${project.url}/trunk`;
  const directory = `${projectsDirectory}/${name}/test`;
  console.log(`Downloading tests for ${name}. . .`.green);
  const token = github.grabLocalToken();
  const cmd = `svn export ${repo}/test ${directory} --password ${token}`;
  const packageName = `${projectsDirectory}/${name}/package.json`;
  const packageCmd = `svn export ${repo}/package.json ${packageName} --password ${token}`;
  if (fs.existsSync(directory)) {
    console.log('Skipping tests.'.green);
    runTests(project, submitFlag);
  } else {
    exec(cmd, function (error) {
      if (error) return console.log(`There was an error. ${error}`);
      console.log('Successfully downloaded tests!'.green);
      if (!fs.existsSync(packageName)) {
        exec(packageCmd, function () {
          console.log('Package.json successfully installed'.green);
          runTests(project, submitFlag);
        });
      } else {
        runTests(project, submitFlag);
      }
    });
  }
}

// Originally a part of runTests
// Combines project name to the project directory
// Makes command to enter project directory
// Makes command to install npm dependencies
// Attempted to use node's process module to change directory, did not work
// Attempts to run both commands together with promisified child_process
// If error, runs postTestCleanup to delete new directories so students can't have them
// If no error, calls runTests function
// function setEnv(project, submitFlag) {
//   const name = changeCase.paramCase(project.name);
//   const directory = `${projectsDirectory}/${name}/node_modules`;
//   console.log('Installing dependencies. . .'.green);
//   // const directory = `${projectsDirectory}/${name}/`;
//   const enterDirectory = `cd ${projectsDirectory}/${name}/`;
//   const installDependencies = 'npm install';
//   const cmd = `${enterDirectory} && ${installDependencies}`;
//   if (fs.existsSync(directory)) {
//     console.log('Skipping dependencies.'.green);
//     runTests(project, submitFlag);
//   } else {
//     exec(cmd, function (err) {
//       if (err) {
//         console.log('There was an error installing dependencies, show this to your teacher:'.red, err);
//         return postTestCleanup(project);
//       }
//       console.log('Successfully installed dependencies!'.green);
//       runTests(project, submitFlag);
//     });
//   }
// }

// Creates command to enter project directory
// Creates command to run tests
// Command has been everything from 'npm run test', to literally the
// script in 'npm run test', to this current version with absolute directory
// May need --use_strict tag, but that throws an error (exit with code 9, unknown argument)
// when used with other commands
// If error, runs postTestCleanup to delete new directories so students can't have them
// If no error, calls postTestCleanup function
function runTests(project, submitFlag) {
  const name = changeCase.paramCase(project.name);
  console.log('Running tests. . .'.green);
  const directory = `${projectsDirectory}/${name}/`;
  const cmd = `npm test --prefix ${directory}`;
  exec(cmd, function (err, stdout, stderr) {
    if (stderr) {
      return console.log(stderr);
    }
    const start = stdout.indexOf('OS-START') + 9;
    const substr = stdout.slice(start);
    const stop = substr.indexOf('OS-STOP') + start;
    const slicedStdout = stdout.slice(start, stop);
    const split = `{
  "stats": {`;
    const index = slicedStdout.indexOf(split);
    if (index === -1) {
      console.log('There was an error.'.red, err);
    } else {
      const parsedStdout = JSON.parse(slicedStdout.slice(index));
      const stats = parsedStdout.stats;
      console.log(` Total tests:    ${stats.tests}  `.bgBlack.white);
      console.log(` Passing tests:  ${stats.passes}  `.bgBlue.white);
      console.log(` Pending tests:  ${stats.pending}  `.bgYellow.black);
      console.log(` Failing tests:  ${stats.failures}  `.bgRed.white);
      if (submitFlag) {
        submit.checkGrade(project, stats);
      } else if (stats.failures > 0) {
        const failures = parsedStdout.failures;
        failures.forEach(function (currentTest, i) {
          const whichTest = currentTest.fullTitle;
          const stack = currentTest.err.stack.split('\n');
          const stackLineOne = stack[0];
          const stackLineTwo = stack[1];
          const errorInfo = stackLineOne.slice(stackLineOne.indexOf(':'));
          console.log(`${i + 1}) ${whichTest}`.red.bold.underline);
          console.log(`> > > ${errorInfo}`.grey);
          console.log(`> > > ${stackLineTwo}`.grey);
        });
      } else {
        console.log('You did it! 100% complete, now please run'.green, 'os submit'.red);
      }
      // postTestCleanup(project);
    }
  });
}

// Removes unnecessary test and node_modules directory
// Attempted to use rimraf, but did not work
// function postTestCleanup(project) {
//   const name = changeCase.paramCase(project.name);
//   console.log('Running post test script. . .'.green);
//   const enterDirectory = `cd ${projectsDirectory}/${name}/`;
//   const runPostTest = 'npm run posttest';
//   const cmd = `${enterDirectory} && ${runPostTest}`;
//   console.log(cmd);
//   // const name = changeCase.paramCase(project.name);
//   // const removeTests = `rm -rf ${projectsDirectory}/${name}/test`;
//   // const removeNodeModules = `rm -rf ${projectsDirectory}/${name}/node_modules`;
//   // const cmd = `${removeTests} && ${removeNodeModules}`;
//   exec(cmd, () => console.log('Tests and Node Modules removed!'.green));
// }
