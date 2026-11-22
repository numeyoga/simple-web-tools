# Privacy, offline and what is blocked

## What the app reads

Slides reads the folder you choose or drop, in your browser, and nothing else. It reads `slides.md`
as text and gives each image of the folder to the page as a temporary address that only this
browser can use (`blob:`). The files are not copied, not uploaded and not stored: close the
presentation or the tab and the addresses are released. The presentation is read again from the
folder each time you open it.

The only things saved are your **preferences** (language, theme, text size, letter and digit
shortcuts), in the browser, under names that start with `slides-`.

Slides makes **no request to another site**: no analytics, no font or script from a network, no
image from the web.

## What is blocked

A slide can hold HTML, and a presentation may not be yours, so the page is strict:

- **Images from the web** (`https://...`) are not loaded. The slide shows a note with the address,
  instead of the image. Download the image, put it in the folder and refer to it by its path.
- **Embedded images** (`data:`) are not loaded either; the note says so. Put the file in the folder.
- **An image that is not in the folder** shows a note with the path it looked for: check the name
  and the folder you chose.
- **Scripts, event handlers, forms, frames, styles and `javascript:` links** in a slide are removed
  before it is shown. Links to `http:`, `https:` and `mailto:` addresses stay, and open in a new tab.

## Offline

Slides is a web app that installs its own files: after the first visit (online) it opens with no
network, including the example and the diagrams. A new version, when there is one, waits in the
background and a message offers to reload. Your presentations are folders on your disk, so they do
not need the network either.

## Browsers

Choosing and dropping a folder work in current Chrome, Edge, Firefox and Safari. The presenter
window shares the images of the main window through the browser; if you close the main window the
presenter keeps its text but its images no longer load.
