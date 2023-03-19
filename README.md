# ImgBeamer

<img src="app/src/img/icon.svg" width="128">

Try it live [here](https://joedf.github.io/ImgBeamer/app/index.html), no setup or installation required!

Simple demo tool of the image formation[<sup>1</sup>](#references) process used in a Scanning Electron Microscope (SEM).

### Description of Stages / Boxes
1. Sample Ground Truth (map navigation)
2. Subregion/ROI (Region of Interest) View ("zoomed" view)
3. Spot Profile
4. Spot Content
5. Spot Signal (rgba)
6. Spot Layout
7. Sampled Subregion
8. Resulting Subregion
9. Resulting Image (full, "virtual SEM")
 
### Screenshot
![screenshot](misc/screenshot3.png)

### Notes
- Minor pixel value differences in virtualSEM; improved, but could be due to sampling from downsized sampling of the larger full image
- The application is being documented [here](https://github.com/joedf/CAS741_w23).

### References
1. “Image Formation.” In Scanning Electron Microscopy and X-Ray Microanalysis, edited by Joseph I. Goldstein, Dale E. Newbury, Joseph R. Michael, Nicholas W.M. Ritchie, John Henry J. Scott, and David C. Joy, 93–110. New York, NY: Springer, 2018. https://doi.org/10.1007/978-1-4939-6676-9_6.
