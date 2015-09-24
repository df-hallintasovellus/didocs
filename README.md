# Didocs

Language-agnostic documentation generator.

## Description

Didocs is a very simple Javadoc-style annotation parser.
It does not try to parse the source code itself, it just looks for Javadoc
comment start and end tags (ie, `/**` and `*/`). The name of the described
token is found by comparing the words coming after the comments against a
blacklist of reserved keywords.

## Origin

This software was built out of frustration after finding no working
documentation generator for ES7 (neither JSDoc nor ESDoc support it at the time
of writing, September 24th, 2015).

## Usage

```
didocs [--src GLOB] [--dst DIR]
```

`GLOB` is `./*.js` by default.
`DIR` is `doc` by default.

## Supported annotations

  * `@brief`: token description (default mode);
  * `@param {type} name - Description`: method argument description (the dash is
    not mandatory, and neither is the type);
  * `@returns {type} Description`: return type description (a `return` alias
    exists);
  * `@type {type} Description`: variable type and description.
