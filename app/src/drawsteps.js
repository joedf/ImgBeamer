function drawBaseBeam(stage) {
	// create our shape
	var beam = new Konva.Circle({
		x: stage.width() / 2,
		y: stage.height() / 2,
		radius: 70,
		fill: 'white',
		strokeWidth: 0,
	});

	var layer = stages[0].getLayers()[0];
	layer.add(beam);
	layer.draw();

	return beam;
}

function drawBaseImage(stage, oImg, size, doFill = false) {
	var max = size;

	console.log("img natural size:", oImg.naturalWidth, oImg.naturalHeight);
	var img_width = oImg.naturalWidth, img_height = oImg.naturalHeight;

	// image ratio to "fit" in canvas
	var ratio = (img_width > img_height ? (img_width / max) : (img_height / max)) // fit
	if (doFill){
		ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
	}

	var iw = img_width/ratio, ih = img_height/ratio;
	var kImage = new Konva.Image({
		x: (max - iw)/2,
		y: (max - ih)/2,
		image: oImg,
		width: iw, 
		height: ih,
	});

	stage.getLayers()[0].add(kImage);

	stage.draw();

	return kImage;
}

function drawBaseComposite(stage, sImage, sBeam) {
	var layer = stage.getLayers()[0];
	layer.listening(true);

	// Give yellow box border to indicate interactive
	$(stage.getContainer()).css('border-color','yellow')

	var beam = sBeam.clone();
	var image = sImage.clone();
	image.draggable(true);
	
	image.globalCompositeOperation(COMPOSITE_OP);

	layer.add(beam);
	layer.add(image);

	// "pre-zoom" a bit, and start with center position
	scaleOnCenter(stage, image, 1, 4);

	layer.draw();

	return [image, beam];
}

function drawAvgCircle(sourceStage, destStage, sBeam, sImage, updateCallback) {

}