const INPUT_IMAGE = 'src/testimages/grains1c.png';
const COMPOSITE_OP = 'source-in';
// const COMPOSITE_OP = 'destination-in';

const nStages = 6;
var sz = 300;
var mc = $('#main-container');

// first create the stages
var stages = [];
for (let i = 0; i < nStages; i++) {
	var e = $('<div/>').addClass('box').appendTo(mc);
	var stage = new Konva.Stage({
		container: e.get(0),
		width: sz,
		height: sz
	});

	// then create layer and to stage
	var layer = new Konva.Layer();

	// antialiasing
	var ctx = layer.getContext();
	ctx.imageSmoothingEnabled = false;

	// add and push
	stage.add(layer);
	stages.push(stage);
}


// create our shape
var circle = new Konva.Circle({
	x: stage.width() / 2,
	y: stage.height() / 2,
	radius: 70,
	fill: 'cyan',

	/*
	fillRadialGradientStartRadius: 0,
	fillRadialGradientEndRadius: 70,
	fillRadialGradientStartPoint: { x: 0, y: 0 },
	fillRadialGradientEndPoint: { x: 0, y: 0 },
	fillRadialGradientColorStops: [0, 'cyan', 1, 'black'],
	*/

	// stroke: 'red',
	strokeWidth: 0,
});

var s1l = stages[0].getLayers()[0];

// add the shape to the layer
s1l.add(circle);

// draw the image
s1l.draw();

/////////////////////

var max = sz;
var img_width = 1800, img_height = 1350;
var ratio = (img_width > img_height ? (img_height / max) : (img_width / max)) // fill
// fit: var ratio = (img_width > img_height ? (img_width / max) : (img_height / max))

var grains1 = null;

var imageObj = new Image();
imageObj.onload = function () {
	grains1 = new Konva.Image({
		x: 0,
		y: 0,
		image: imageObj,
		width: img_width/ratio,
		height: img_height/ratio,
	});

	// add the shape to the layer
	stages[1].getLayers()[0].add(grains1);

	step3();
};
imageObj.src = INPUT_IMAGE;


function step3(){
	var s3 = stages[2];
	var s3l = s3.getLayers()[0];
	// needed for layers only - listening=false? clonedLayer = layer.clone({ listening: false });
	var cc = circle.clone();
	var gr = grains1.clone();
	gr.draggable(true);
	
	gr.globalCompositeOperation(COMPOSITE_OP);

	s3l.add(cc);
	s3l.add(gr);

	s3l.draw();

	gr.on('mouseup', function() {
		updateAvgCircle();
	});

	gr.on('wheel', function(e){
		// modified from https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html 
		var stage = s3;
		var scaleBy = 1.2;

		// stop default scrolling
		e.evt.preventDefault();

		var oldScale = gr.scaleX();
		var pointer = stage.getPointerPosition();

		var mousePointTo = {
			x: (pointer.x - gr.x()) / oldScale,
			y: (pointer.y - gr.y()) / oldScale,
		};

		// how to scale? Zoom in? Or zoom out?
		let direction = e.evt.deltaY > 0 ? -1 : 1;

		var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
		gr.scale({ x: newScale, y: newScale });

		var newPos = {
			x: pointer.x - mousePointTo.x * newScale,
			y: pointer.y - mousePointTo.y * newScale,
		};
		gr.position(newPos);


		updateAvgCircle();
	});

	/*
	var rect = new Konva.Rect({
		x: 50,
		y: 50,
		// stroke: 'red',
		width: 100,
		height: 100,
		fill: 'red',
		draggable: true,
		globalCompositeOperation: 'xor',
	});
	*/

	// step 4
	/*
	var s4l = stages[3].getLayers()[0];
	// var final = stages[2].toDataURL({ pixelRatio: 3 });
	var final = stages[2].toImage();
	var i = new Konva.Image({image: final});
	s4l.add(i);
	*/
	

	// hide for now
	$(stages[3].getContainer()).hide()

	var final = s3l.toImage({pixelRatio: devicePixelRatio}).then(function(cnvComposite){
		var s4l = stages[3].getLayers()[0];
		
		var kcc = new Konva.Image({
			x: 0,
			y: 0,
			image: cnvComposite,
			width: sz,
			height: sz,
		});
		
		s4l.add(kcc);
	})
	
	/*
	// method 2
	var pImg = $('<img/>').addClass('box out').appendTo(mc);
	var finalB64 = s3l.toDataURL({ pixelRatio: devicePixelRatio });
	pImg.attr({
		src: finalB64,
		width: sz,
		height: sz,
	});
	*/

	var s3lcx = s3l.getContext();
	console.log("p:[0, 0]", s3lcx.getImageData(0, 0, 1, 1).data.toString());
	console.log("p:["+(s3lcx.canvas.width/2)+", "+(s3lcx.canvas.height/2)+"]", s3lcx.getImageData(
		s3lcx.canvas.width / 2,
		s3lcx.canvas.height / 2,
		1, 1).data.toString());
		
		updateAvgCircle();
	}
	
function updateAvgCircle(){
	var s3lcx = stages[2].getLayers()[0].getContext();
	var allPx = s3lcx.getImageData(0, 0, s3lcx.canvas.width, s3lcx.canvas.height);
	var avgPx = get_avg_pixel_rgba(allPx);

	var s5l = stages[4].getLayers()[0];

	var avgCircle = null;
	if (s5l.getChildren().length <= 0){
		avgCircle = circle.clone();
		s5l.add(avgCircle);
	} else {
		avgCircle = s5l.getChildren()[0];
	}

	var avgColor = "rgba("+ avgPx.join(',') +")";
	avgCircle.stroke(avgColor);
	avgCircle.fill(avgColor);

	s5l.draw();
}

function get_avg_pixel_rgba(raw) {
	var blanks = 0;
	var d = raw.data;

	var sum = [0, 0, 0, 0];

	for (var i = 0; i < d.length; i += 4) {
		// Optimization note, with greyscale we only need to process one component...
		const px = [d[i], d[i+1], d[i+2], d[1+3]];
		// var r = px[0], g = px[1], b = px[2], a = px[3];

		if (px.every(c => c === 0)) {
			blanks += 1;
		} else {
			sum[0] += px[0];
			sum[1] += px[1];
			sum[2] += px[2];
			sum[3] += px[3];
		}
	}

	var total = raw.width * raw.height;
	// or eq... var total = d.length / 4;
	var fills = total - blanks;

	var avg = [
		Math.round(sum[0] / fills),
		Math.round(sum[1] / fills),
		Math.round(sum[2] / fills),
		(255 - Math.round(sum[3] / fills)) / 255 // rgba - alpha is 0.0 to 1.0
	];

	var percent = (blanks / total) * 100;
	console.log(blanks, total, percent);
	console.log("avg px=", avg.toString());

	return avg;
}