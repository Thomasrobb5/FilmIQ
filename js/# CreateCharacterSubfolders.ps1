# CreateCharacterSubfolders.ps1
# Creates subfolders for each character within their theme folders.

# Ensure Downloads folder exists
$rootDownloadPath = "W:\temp\Character Game"
if (!(Test-Path $rootDownloadPath)) {
    New-Item -ItemType Directory -Path $rootDownloadPath -Force | Out-Null
    Write-Host "Created root folder: $rootDownloadPath" -ForegroundColor Green
}

# Define themes and their character lists
$themes = @{
    "Star Wars" = @(
        "Luke Skywalker", "Leia Organa", "Han Solo", "Darth Vader", "Obi-Wan Kenobi", "Yoda", "Anakin Skywalker",
        "Padmé Amidala", "Rey", "Finn", "Poe Dameron", "Kylo Ren", "Darth Maul", "Emperor Palpatine",
        "Lando Calrissian", "Chewbacca", "R2-D2", "C-3PO", "Mace Windu", "Qui-Gon Jinn", "Ahsoka Tano",
        "Jango Fett", "Boba Fett", "Count Dooku", "General Grievous", "Asajj Ventress", "Thrawn",
        "Sabine Wren", "Ezra Bridger", "Kanan Jarrus", "Rose Tico", "Admiral Ackbar", "Mon Mothma"
    )
    "Harry Potter" = @(
        "Harry Potter", "Hermione Granger", "Ron Weasley", "Albus Dumbledore", "Severus Snape", "Voldemort",
        "Draco Malfoy", "Sirius Black", "Remus Lupin", "James Potter", "Lily Potter", "Ginny Weasley",
        "Neville Longbottom", "Luna Lovegood", "Fred Weasley", "George Weasley", "Minerva McGonagall",
        "Rubeus Hagrid", "Bellatrix Lestrange", "Lucius Malfoy", "Nymphadora Tonks", "Cedric Diggory",
        "Cho Chang", "Viktor Krum", "Fleur Delacour", "Dolores Umbridge", "Kingsley Shacklebolt",
        "Molly Weasley", "Arthur Weasley", "Dobby", "Hedwig", "Bill Weasley"
    )
    "Marvel" = @(
        "Tony Stark", "Steve Rogers", "Thor", "Natasha Romanoff", "Bruce Banner", "Clint Barton",
        "Peter Parker", "Stephen Strange", "Wanda Maximoff", "Vision", "T’Challa", "Carol Danvers",
        "Nick Fury", "Loki", "Thanos", "Gamora", "Nebula", "Rocket Raccoon", "Groot", "Peter Quill",
        "Drax", "Sam Wilson", "Bucky Barnes", "Pepper Potts", "Rhodey", "Okoye", "Shuri", "M’Baku",
        "Erik Killmonger", "Hela", "Valkyrie", "Scott Lang", "Hope van Dyne", "Wong", "Korg"
    )
    "X-Men" = @(
        "Charles Xavier", "Erik Lehnsherr", "Logan", "Jean Grey", "Scott Summers", "Ororo Munroe",
        "Rogue", "Raven Darkhölme", "Hank McCoy", "Kurt Wagner", "Remy LeBeau", "Kitty Pryde",
        "Colossus", "Jubilee", "Bobby Drake", "Psylocke", "Emma Frost", "Cable", "Deadpool",
        "Apocalypse", "Sabretooth", "Toad", "Pyro", "Warren Worthington III", "Bishop", "Storm",
        "Dazzler", "Havok", "Polaris", "Laura Kinney"
    )
    "Game of Thrones" = @(
        "Jon Snow", "Daenerys Targaryen", "Tyrion Lannister", "Cersei Lannister", "Jaime Lannister",
        "Sansa Stark", "Arya Stark", "Ned Stark", "Catelyn Stark", "Robb Stark", "Bran Stark",
        "Rickon Stark", "Theon Greyjoy", "Petyr Baelish", "Varys", "Joffrey Baratheon",
        "Tywin Lannister", "Stannis Baratheon", "Davos Seaworth", "Melisandre", "Brienne of Tarth",
        "Sandor Clegane", "Gregor Clegane", "Samwell Tarly", "Gilly", "Jorah Mormont", "Bronn",
        "Tormund Giantsbane", "Ygritte", "Missandei", "Grey Worm", "Olenna Tyrell", "Margaery Tyrell",
        "Ramsay Bolton"
    )
    "Lord of the Rings" = @(
        "Frodo Baggins", "Samwise Gamgee", "Gandalf", "Aragorn", "Legolas", "Gimli", "Bilbo Baggins",
        "Sauron", "Saruman", "Gollum", "Merry Brandybuck", "Pippin Took", "Boromir", "Faramir",
        "Éowyn", "Éomer", "Arwen", "Elrond", "Galadriel", "Celeborn", "Théoden", "Wormtongue",
        "Denethor", "Treebeard", "Haldir", "Glorfindel", "Radagast", "Beorn", "Bard the Bowman",
        "Thranduil"
    )
    "Star Trek" = @(
        "James T. Kirk", "Spock", "Leonard McCoy", "Nyota Uhura", "Montgomery Scott", "Hikaru Sulu",
        "Pavel Chekov", "Jean-Luc Picard", "William Riker", "Data", "Deanna Troi", "Beverly Crusher",
        "Worf", "Geordi La Forge", "Kathryn Janeway", "Chakotay", "Tuvok", "Seven of Nine",
        "B’Elanna Torres", "Tom Paris", "Harry Kim", "The Doctor", "Benjamin Sisko", "Kira Nerys",
        "Odo", "Jadzia Dax", "Quark", "Rom", "Nog", "Miles O’Brien"
    )
    "Transformers" = @(
        "Optimus Prime", "Bumblebee", "Megatron", "Starscream", "Soundwave", "Shockwave", "Ratchet",
        "Ironhide", "Jazz", "Sideswipe", "Sunstreaker", "Wheeljack", "Prowl", "Bluestreak",
        "Grimlock", "Slag", "Sludge", "Snarl", "Swoop", "Devastator", "Bonecrusher", "Scrapper",
        "Hook", "Barricade", "Blackout", "Arcee", "Hot Rod", "Drift"
    )
    "Fast and Furious" = @(
        "Dominic Toretto", "Brian O’Conner", "Letty Ortiz", "Mia Toretto", "Roman Pearce", "Tej Parker",
        "Luke Hobbs", "Deckard Shaw", "Han Lue", "Gisele Yashar", "Vince", "Jesse", "Leon",
        "Elena Neves", "Ramsey", "Mr. Nobody", "Little Nobody", "Cipher", "Jakob Toretto",
        "Santos", "Leo", "Rico Santos", "Tego Leo", "Fenix Calderon", "Owen Shaw", "Queenie Shaw",
        "Sean Boswell", "Twinkie"
    )
}

foreach ($theme in $themes.Keys) {
    Write-Host "Processing theme: $theme" -ForegroundColor Green
    $themePath = Join-Path $rootDownloadPath $theme
    if (!(Test-Path $themePath)) {
        New-Item -ItemType Directory -Path $themePath -Force | Out-Null
        Write-Host "Created theme folder: $themePath" -ForegroundColor Yellow
    }

    foreach ($name in $themes[$theme]) {
        $safeName = $name -replace '[<>:"/\\|?*]', '_'  # Sanitize name for folder
        $characterPath = Join-Path $themePath $safeName
        if (!(Test-Path $characterPath)) {
            New-Item -ItemType Directory -Path $characterPath -Force | Out-Null
            Write-Host "Created character folder: $characterPath" -ForegroundColor Yellow
        } else {
            Write-Host "Skipped (exists): $name in $theme" -ForegroundColor Gray
        }
    }
}

Write-Host "Folder creation complete! Check the '$rootDownloadPath' folder." -ForegroundColor Green