// *******************************************************************
// ********************    FILE 1   **********************************
// ENVIRONMENT SETUP AND VALIDATION 
/*import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: "Say this is a test" }],
    model: "gpt-4o-mini",
});
*/
// *******************************************************************
// ********************    FILE 2   **********************************
// OPENAI API Function Creation


// Use the openai package
// const OpenAI = require("openai");
// Unable to use require, using import instead

import OpenAI from "openai"; 


// For privacy, I am using the SDK format to retrieve the key
// Currently, using a personal paid account for API key usage
// Creates an instance of the OpenAI client with the API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// For now using, a fixed set of genres 
const genres = [
    "Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Blues", "R&B", "Soul", 
    "Country", "Electronic", "Reggae", "Funk", "Disco", "Folk", "Metal", 
    "Punk", "Alternative", "Indie Rock", "K-Pop"
  ];

// Function to randomly select a genre
function getRandomGenre() {
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];

    console.log(`Selected Genre: ${randomGenre}`); 
    return randomGenre; 
}

// Function to split the string by '-' and remove quotes
function splitTitleAndArtist(input) {
    // Remove double quotes
    const cleanedInput = input.replace(/"/g, '');

    // Split the string
    const [songTitle, artistName] = cleanedInput.split(' - ');

    console.log(`[splitTitleAndArtist]: ${songTitle}, ${artistName}`);
    return [songTitle, artistName];
    
}

// Function to get a song and artist suggestion from OpenAI based on the genre
async function getSongAndArtistByGenre(genre) {
    try 
    {
        const response = await openai.chat.completions.create({
            messages: [{
                role: "user",
                content: `Suggest a random song and artist from the ${genre} genre. Format your response as follows: "Song Title - Artist Name".`
            }],
            // Currently, using GPT-4, might have to experiment with other models
            model: "gpt-4o-mini",
        });

        // Extract song title and artist from the response
        const songAndArtist = response.choices[0].message.content.trim(); 
        // Split into title and artist using the new format
        const [songTitle, artistName] = splitTitleAndArtist(songAndArtist);

        console.log(`Track Title: ${songTitle}, Artist: ${artistName}`);
        
        // Return structured output with only song and artist name
        // Should I return an array instead? 
        return { song: songTitle, artist: artistName };
    } 
    catch (error) 
    {
        console.error("[Error]: Unable to generate a song", error);
        return null;
    }
} 

// Main function to execute the random selection and fetching process
async function main() {
    const selectedGenre = getRandomGenre(); // Get a random genre
    const result = await getSongAndArtistByGenre(selectedGenre); // Get song and artist suggestion based on genre
    console.log(result); // Log the final result
}

// [IN WORK] Random genre function, instead of selecting from a database
async function getSongAndArtistByGenre(genre) {

}
// Run the main function
main();

