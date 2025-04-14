/* exported
G_INPUT_IMAGE
G_PRELOADED_IMAGES
G_PRELOADED_IMAGES_ROOT
*/

/**
 * The list of default/preloaded images to use with the application.
 * @see G_PRELOADED_IMAGES_ROOT
 */
const G_PRELOADED_IMAGES = [
	"tephra_200nm.png",
	"tephra_448nm.png",
	"grains1.png",
	"grains2full.png",
	"grains2nc.png",
	"grains2tl.png",
	"bavley/APT_needle_8nm.png",
	"bavley/dots_8nm.png",
	"bavley/grid_34nm.png",
	"bavley/pattern_4nm.png",
	"bavley/squares_42nm.png",
	"caleb/Array3_58nm.png",
	"caleb/beam_issue_001_40.4nm.png",
	"caleb/Fun_002_348.4nm.png",
	"caleb/Long_Live_the_King_69nm.png",
	"caleb/overhead_009_451.5nm.png",
	"caleb/overheads_018_19nm.png",
	"caleb/sharpie_15nm.png",
	"caleb/WG_036_131nm.png",
];

/** The root folder for all the preloaded images specified by {@link G_PRELOADED_IMAGES}. */
const G_PRELOADED_IMAGES_ROOT = "src/testimages/";

/** global variable to set the input ground truth image */
// var G_INPUT_IMAGE = Utils.getGroundtruthImage();
var G_INPUT_IMAGE = G_PRELOADED_IMAGES_ROOT + 'grains2tl.png';

// Preload the larger image files in the background
// without blocking the UI for improved responsiveness
window.addEventListener('load', function(){
	// https://stackoverflow.com/a/59861857/883015
	// var images = G_PRELOADED_IMAGES;
	var images = ['tephra_448nm.png', 'tephra_200nm.png'];
	var preload = '';
	for(let i = 0; i < images.length; i++) {
		preload += '<link rel="preload" href="' + G_PRELOADED_IMAGES_ROOT
		+ images[i] + '" as="image">\n';
	}
	$('head').append(preload);
});

// Add the preloaded images to the menubar
(function() { // use self-executing func to avoid more global vars
	let menu = $('#menu_preloaded_images');
	let lastFolder = null;
	let submenu = null;
	const pxSize_needle = new RegExp(/_[\d.]+nm\./, "i");
	for (let i = 0; i < G_PRELOADED_IMAGES.length; i++) {
		const img = G_PRELOADED_IMAGES[i]; // relative filepath
		let name = img; // name shown to user
		
		// check if new to make a submenu of the image is from a subfolder
		if (img.indexOf('/') > 1){
			let newFolder = img.split('/')[0];
			if (newFolder != lastFolder) {
				let id = '_menu_'+newFolder;
				let _subHtml = '<li><div><span class="ui-icon ui-icon-folder-collapsed"></span>'
				+ newFolder +'</div><ul id="'+id+'"></ul></li>';
				menu.append(_subHtml);
				submenu = $('#'+id);
				lastFolder = newFolder;
			}
			name = img.split('/')[1];
		}

		// check if filename has pixel size
		let pixelSize = '';
		if (img.indexOf('nm.') > 1) {
			try {
				// attempt to parse for pixelsize from filepath
				// pattern is "folder/somename_{pixel.size}nm.ext"
				let num = parseFloat(img.match(pxSize_needle)[0].split('nm')[0].replace('_',''));
				if (!isNaN(num)) {
					pixelSize = ' data-pixelsize-nm="' + num + '" ';
				}
			} catch (error) {
				pixelSize = '';
			}
		}
		
		// menu item html
		const _html = '<li data-image-filename="'+img+'"'+pixelSize+'>'
			+'<div><span class="ui-icon ui-icon-image"></span>' + name + '</div></li>';

		// check if we add an item/image to a submenu or not
		if (submenu != null) {
			submenu.append(_html);
		} else {
			submenu = null;
			menu.append(_html);
		}
	}
})();
