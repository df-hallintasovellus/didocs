var fs = require("fs");
var path = require("path");
var util = require("util");

var gulp = require("gulp");
var through2 = require("through2");

var jade = require("jade");
var md = require("markdown-it")();

/**
 * Checks if a token is an identifier.
 * @param {string} identifier - Identifier to validate.
 * @returns {boolean} Whether the token is a valid identifier.
 */
function isIdentifier(token) {
    return typeof token === "string" &&
        [ "function", "var" ].indexOf(token) === -1;
}

/**
 * Finds the next identifier declared in the code.
 * @param {string} code - Code to analyse.
 * @returns {string} Next identifier found in the code.
 */
function getFirstIdentifier(code) {
    return code.match(/(\w|\.)+/g).reduce(function(found, token) {
        return found ? found : isIdentifier(token) ? token : undefined
    }, undefined);
}

/**
 * A block of documentation.
 * @param {string} commentBlock - Block of source documentation.
 * @param {string} codeBlock - Block of source code.
 */
function Doc(commentBlock, codeBlock) {
    this.name = getFirstIdentifier(codeBlock);
    this.indentation = commentBlock.match(/^\s*(\*\s*)/)[0].length;
    commentBlock
        .split("\n")
        .map(function(line) {
            return line.slice(this.indentation);
        }, this)
        .filter(function(comment) {
            return comment.trim().length > 0;
        })
        .reduce(function(comments, comment) {
            if (comment.charAt(0) === "@")
                comments.push(comment);
            else
                comments.push(comments.pop() + " " + comment);
            return comments;
        }, [ "@brief" ])
        .forEach(function(comment) {
            var command = comment.match(/\w+/)[0];
            try {
                if (command in this.commands)
                    this.commands[command].call(this, comment.slice(1 + command.length).trim());
                else
                    console.warn("Unknown annotation '" + command + "' in '" + comment + "'");
            } catch (e) {
                e.message += " in '" + comment + "'";
                console.error(e);
            }
        }, this);
}

/**
 * @type {Object.<string,function>} Map containing known documentation commands.
 */
Doc.prototype.commands = {};

/**
 * Adds a brief description of the function.
 */
Doc.prototype.commands.brief = function(brief) {
    this.brief = brief.trim();
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
    this.commands.brief(line);
}

/**
 * Runs the parser on some source code.
 * @param {string} sourceCode - Source code to parse.
 * @returns {Doc[]} Parsed documentation.
 */
function parseSourceCode(sourceCode) {
    return (" " + sourceCode)
        .split("/**\n")
        .filter(function(el, i) {
            return i > 0;
        })
        .map(function(el, i) {
            var blocks = el.split("*/").slice(0, 2);
            if (blocks !== null)
                return new Doc(blocks[0], blocks[1]);
        });
}

/**
 * @type {Transform} Converts source file to HTML docs.
 */
var renderFile = function(options) {
    return through2.obj(function(file, encoding, callback) {
        try {
            var docs = parseSourceCode(file.contents.toString());
            var html = options.template({
                docs: docs,
                file: file,
                md: md
            });
            file.contents = new Buffer(html);
            file.path += options.templateExt;
            callback(null, file);
        } catch (err) {
            callback(err);
        }
    });
}

/**
 * Command line options (default values).
 */
var OPTIONS = {
    src: "./*.js",
    dest: "./doc/",
    template: jade.compileFile(path.join(__dirname, "template.jade")),
    templateExt: ".html"
};

/**
 * Parses the command line to detect the options.
 * @returns {Object} Option map.
 * @see OPTIONS
 */
function parseCommandLine() {
    var args = process.argv.slice(2);
    var options = util._extend({}, OPTIONS);
    while (args.length > 0) {
        var arg = args.shift();
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
            default:
                throw new Error("Unknown argument: " + arg);
        }
    }
    return options;
}

/**
 * Runs the parser and formatter.
 */
function run(options) {
    return gulp.src(options.src, { base: "./" })
        .pipe(renderFile(options))
        .pipe(gulp.dest(options.dest));
}

if (require.main === module)
    run(parseCommandLine());

module.exports = {
    run: run
};
