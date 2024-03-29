# ImgBeamer

<img src="app/src/img/icon.svg" width="128">

Try it live [here](https://joedf.github.io/ImgBeamer/app/index.html), no setup or installation required!

Simple demo tool of the image formation[<sup>1</sup>](#references) process used in a Scanning Electron Microscope (SEM).

A quick start guide is available [here](https://joedf.github.io/ImgBeamer/misc/ImgBeamer_QS_guide.pdf).

The source code is available [here](https://github.com/joedf/ImgBeamer).

### Description of Stages / Boxes
1. **Sample Ground Truth** (map navigation): a view the full image where the highlighted area represents the subregion area.
2. **Subregion** or ROI (Region of Interest) View ("zoomed" view): a view of the subregion area as highlighted in the Sample Ground Truth.
3. **Spot Profile**: visualization of the spot profile (shape and size) by changing the relative width/height, scale, and rotation.
4. **Spot Content**: visualization of the spot content (Subregion “stenciled” with the spot profile) or area sampled by the spot.
5. **Spot Signal** (rgba): the signal or pixel value to represent what has been sampled by the spot or beam, or the average pixel value from the Spot Content.
6. **Spot Layout**: the layout of the sampling grid or array of spot sampling positions over the Subregion area.
7. **Sampled Subregion**: the sampled or "stenciled" content of the Subregion as depicted by the Spot Layout.
8. **Resulting Subregion**: the resulting image by filing each pixel in the grid by the signal of each corresponding spot as depicted in the Spot Layout.
9. **Resulting Image** (full, "virtual SEM"): the resulting image full where the imaging process, as shown in the Resulting Subregion, is continued for the full extent of the Sample Ground Truth image.
 
### Screenshot
![screenshot](misc/screenshot4.png)

### Notes
- Minor pixel value differences in virtualSEM; improved, but could be due to sampling from downsized sampling of the larger full image
	- This is possibly due to canvas "alpha premultiplication", see [here](https://github.com/joedf/ImgBeamer/issues/25).
- The application design is being documented [here](https://github.com/joedf/CAS741_w23).
- `main` is the stable branch, `cas741` is an outdated development branch.

### Developer Instructions and Notes
- The main application is implemented entirely in javascript
	- You can run it either using the auto-deployed GitHub pages version ("live" link above).
	- Or you can run it on your own machine with a local web server pointed to the `app/` folder
		- either [XAMPP](https://www.apachefriends.org/) or even just a python HTTP server with `python -m http.server --directory app/`
	- jsdoc-generated **documentation** pages are available [here](https://joedf.github.io/ImgBeamer/jsdocs/index.html)
- Tests for the image metrics are available under `tests/`:
	- `og` is code for "original" (unmodified) image, and `fant` refers to a down-sampled image using Fant's algorithm[<sup>2</sup>](#references).
	- `js-tests/`: for javascript implementations
		- open the `index.html` page (using a local web server as described above) and look in the webconsole.
		- Optionally, an online hosted version exists [here](https://joedf.github.io/ImgBeamer/tests/image_metrics/js-tests/).
		- mainly in the webconsole, you can use `run_all(fant)` where if `fant` is true, all the image comparison tests will be run using the "fant-sampled" image as the ground truth. Otherwise (false), it will use the "original" image as the ground truth instead.
	- `py-tests/`: for python implementations
		- Install Python v3.10.6 or better (has not been tested on other versions)
		- You'll likely need to run `pip install sewar` *once* to get the required image metrics module/library.
		- run `imgquality.py`
	- The other folders and files are from preliminary and manual testing that was done in the past.

### References
1. “Image Formation.” In Scanning Electron Microscopy and X-Ray Microanalysis, edited by Joseph I. Goldstein, Dale E. Newbury, Joseph R. Michael, Nicholas W.M. Ritchie, John Henry J. Scott, and David C. Joy, 93–110. New York, NY: Springer, 2018. https://doi.org/10.1007/978-1-4939-6676-9_6.
2. Fant, Karl M. “A Nonaliasing, Real-Time Spatial Transform Technique.” IEEE Computer Graphics and Applications 6, no. 1 (January 1986): 71–80. https://doi.org/10.1109/MCG.1986.276613.

