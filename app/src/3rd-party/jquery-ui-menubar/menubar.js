// jquery-ui menubar by joedf
// Started April 7th, 2025

// menubar / filemenu that use jquery-ui menus and follows the theme

// Inspired by the following
// https://github.com/Barry127/fileMenu
// https://codepen.io/seungjaeryanlee/pen/YYoGbp

// Iinitialize menubar
$(document).ready(function () {
	// change internal default for menu delay
	// https://stackoverflow.com/a/79562039/883015
	$.ui.menu.prototype.delay = 10;
	$('.menubar').menu({
		position: { my: 'left top', at: 'left bottom' },
		focus: function (e, ui) {
			let parent = $(ui.item).parent().get(0);
			let root = $(this).get(0);
			let sub = (parent != root);
			if (sub) {
				$(this).menu('option', 'position', { my: 'left top', at: 'right top' });
			} else {
				$(this).menu('option', 'position', { my: 'left top', at: 'left bottom' });
			}
		},
	});
});