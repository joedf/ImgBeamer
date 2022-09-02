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