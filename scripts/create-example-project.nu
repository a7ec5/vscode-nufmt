#!/usr/bin/env nu
# Creates a sample Nushell project under temp/ for trying the formatter by hand.

const PROJECT_DIRECTORY = "temp/example-project"

const PROJECT_FILES = [
    {
        path: "nufmt.nuon"
        content: '{
    indent: 2
    indent_char: "space"
    line_length: 80
    margin: 1
    exclude: []
    consistent_branches: "always"
}
'
    }
    {
        path: "main.nu"
        content: 'def greet [name] {
print $"hello, ($name)"
}

let numbers = [1,2,3]
let doubled = $numbers | each {|value| $value * 2 }

if ($doubled | length) > 2 {
    print "many"
} else {
    print "few"
}

greet "nushell"
'
    }
    {
        path: "nested/deep.nu"
        content: 'let config = {name: "example", values: [1,2]}
print $config.name
'
    }
]

def main [] {
    let repository = $env.FILE_PWD | path dirname
    let target = $repository | path join $PROJECT_DIRECTORY

    rm --recursive --force $target
    mkdir $target

    for file in $PROJECT_FILES {
        let destination = $target | path join $file.path
        mkdir ($destination | path dirname)
        $file.content | save --force $destination
    }

    print $"Created ($target)."
    print "Open it as the workspace and run Format Document on main.nu; the project nufmt.nuon should indent by two spaces."
}
