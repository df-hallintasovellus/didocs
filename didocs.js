#!/usr/bin/env node

var fs = require("fs");
var path = require("path");
var util = require("util");

var gulp = require("gulp");
var through2 = require("through2");

var pug = require("pug");
var md = require("markdown-it")();

var debug = require("debug");
var packageName = require("./package.json").name;
var red = "\x1b[31m";
var yellow = "\x1b[33m";

/**
 * Checks if a token is an identifier.
 * @param {string} identifier - Identifier to validate.
 * @returns {boolean} Whether the token is a valid identifier.
 */
function isIdentifier(token) {
    if (!(typeof token === "string"))
        return false;

    const isReservedWord = [ "function", "var", "const", "export", "import", "fun" ].indexOf(token) !== -1;
    const isAnnotation = ['@'].indexOf(token.charAt(0)) !== -1;

    return !isReservedWord && !isAnnotation;
}

/**
 * Finds the next identifier declared in the code.
 * @param {string} code - Code to analyse.
 * @returns {string} Next identifier found in the code.
 */
function getFirstIdentifier(code) {
    return code.match(/([\w\.@]+)/g).reduce(function(found, token) {
        return found ? found : isIdentifier(token) ? token : undefined
    }, undefined);
}

/**
 * A block of documentation.
 * @param {string} commentBlock - Block of source documentation.
 * @param {string} codeBlock - Block of source code.
 * @param {string} log - Logger used for this file.
 */
function Doc(commentBlock, codeBlock, log) {
    this.name = getFirstIdentifier(codeBlock);
    this.indentation = commentBlock.match(/^\s*(\*\s*)/)[0].length;
    log("parsing", this.name);
    commentBlock
        .split("\n")
        .map(function(line) {
            return line.slice(this.indentation);
        }, this)
        .filter(function(comment) {
            return comment.trim().length > 0;
        })
        .forEach(function(comment) {
            if (comment.charAt(0) !== "@") {
                var command = 'description'
                var arg = comment
            } else {
                var command = comment.match(/\w+/)[0];
                var arg = comment.slice(1 + command.length).trim()
            }

            try {
                if (command in this.commands)
                    this.commands[command].call(this, arg);
                else
                    log(yellow + "unknown annotation", comment);
            } catch (err) {
                err.message += " in '" + comment + "'";
                log(red + "error", err);
            }
        }, this);
}

/**
 * @type {Object.<string,function>} Map containing known documentation commands.
 */
Doc.prototype.commands = {};

/**
 * Adds a line of description.
 */
Doc.prototype.commands.description = function(description) {
    this.description = (this.description || "") + description.trim() + '\n';
}

/**
 * Adds a brief description of the function.
 */
Doc.prototype.commands.brief = function(brief) {
    this.brief = brief.trim();
}

/**
 * 
 */
Doc.prototype.commands.feature = function(feature) {
    this.feature = (this.feature || []).concat(feature.trim());
}

/**
 * Adds a method parameter description.
 */
Doc.prototype.commands.param = function(line) {
    if (!this.args)
        this.args = [];
    var type = line.match(/^\{(.+)\}\s*/);
    if (type !== null) {
        line = line.slice(type[0].length);
        type = type[1].trim();
    }
    var name = line.match(/^(\w+)\s*(-\s*)?/);
    if (name !== null) {
        line = line.slice(name[0].length);
        var name = name[1];
    }
    var brief = line.trim();
    this.args.push({
        brief: brief,
        name: name,
        type: type
    });
}

/**
 * Adds a return type description.
 */
Doc.prototype.commands.returns = function(line) {
    var type = line.match(/^\{(.+)\}/);
    if (type !== null) {
        line = line.slice(type[0].length);
        type = type[1].trim();
    }
    var brief = line.trim();
    this["return"] = {
        brief: brief,
        type: type
    };
}

Doc.prototype.commands["return"] = Doc.prototype.commands.returns;

/**
 * Adds the type of a variable.
 */
Doc.prototype.commands.type = function(line) {
    var type = line.match(/^\{(.+)\}/);
    if (type !== null) {
        line = line.slice(type[0].length);
        type = type[1].trim();
    }
    this.type = type;
    this.commands.brief.bind(this)(line);
}

/**
 * Runs the parser on some source code.
 * @param {string} sourceCode - Source code to parse.
 * @param {string} log - Logger used for this file.
 * @returns {Doc[]} Parsed documentation.
 */
function parseSourceCode(sourceCode, log) {
    var commentBlocks = (" " + sourceCode)
        .split("/**\n")
        .filter(function(el, i) {
            return i > 0;
        });
    log("detecting", commentBlocks.length);
    return commentBlocks.map(function(el, i) {
        var blocks = el.split("*/").slice(0, 2);
        if (blocks !== null)
            return new Doc(blocks[0], blocks[1], log);
    });
}

/**
 * @type {Transform} Converts source file to HTML docs.
 */
var renderFile = function(options) {
    return through2.obj(function(file, encoding, callback) {
        var log = debug(packageName + ":renderFile");
        try {
            log("starting", file.path);
            var docs = parseSourceCode(file.contents.toString(), log);
            log("rendering");
            var html = options.template({
                docs: docs,
                file: file,
                md: md
            });
            log("done");
            file.contents = new Buffer.from(html);
            file.path += options.outputExt;
            callback(null, file);
        } catch (err) {
            log("error", err);
            callback(err);
        }
    });
}

/**
 * @type {Object} Command line options (default values).
 */
var OPTIONS = {
    src: "./*.js",
    dest: "./doc/",
    template: path.join(__dirname, "json.pug"),
    outputExt: ".html"
};

/**
 * Parses the command line to detect the options.
 * @returns {Object} Option map.
 * @see OPTIONS
 */
function parseCommandLine() {
    var args = process.argv.slice(2);
    var options = util._extend({}, OPTIONS);
    var log = debug(packageName + ":parseCommandLine");
    while (args.length > 0) {
        var arg = args.shift();
        log("argument", arg);
        switch (arg) {
            case "--src":
                options.src = args.shift();
                if (options.dest === undefined)
                    throw new Error("Missing argument for " + arg);
                break;
            case "--dest":
                options.dest = args.shift();
                if (options.dest === undefined)
                    throw new Error("Missing argument in " + arg);
                break;
            case "--template":
                options.template = args.shift();
                if (options.template === undefined)
                    throw new Error("Missing argument in " + arg);
                break;
            case "--outputExt":
                options.outputExt = args.shift();
                if (options.outputExt === undefined)
                    throw new Error("Missing argument in " + arg);
                break;
            default:
                throw new Error("Unknown argument: " + arg);
        }
    }

    debug("options", options);
    return options;
}

/**
 * Runs the parser and formatter.
 */
function run(options) {
    if (typeof options.template === 'string') {
        options.template = pug.compileFile(options.template);
    }

    return gulp.src(options.src, { base: "./" })
        .pipe(renderFile(options))
        .pipe(gulp.dest(options.dest));
}

if (require.main === module)
    run(parseCommandLine());

module.exports = {
    run: run
};
