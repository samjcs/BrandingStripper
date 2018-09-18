# BrandingStripper

This tool was created to automate the process of branding an application to a client’s website. 
You simply pass in a URL, gulp downloads and removes all JS, and extracts all inline CSS to a separate .CSS file.
Everything is moved into a branding folder where template.htm is the main index.html. The theme folder contains the fonts, images, and CSS files.

All other files are folder names after the website under downloads.

clone and run npm install in the directory

# Commands

```
gulp --url www.somewebsite.com/IneedToDownLoad
```
Downloads and strips/cleans the website


```
gulp save
```
Saves the current files in the branding folder into a holding folder


```
gulp reset
```
Moved files from the holding folder to the branding folder


```
gulp start-fresh
```
Deletes everything out of the Branding, holding, and downloads Folder

