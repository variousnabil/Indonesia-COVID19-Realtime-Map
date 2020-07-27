const urlCOVID = 'https://indonesia-covid-19-api.now.sh/api/provinsi';
const urltopoIDN = 'https://raw.githubusercontent.com/ghapsara/indonesia-atlas/master/provinsi/provinces-simplified-topo.json';

const w = 1300;
const h = 600;

const margin = {
    top: 36,
    right: 32,
    bottom: 36,
    left: 32
}

const projection = d3.geoMercator()
    .center([118.25, - 5])
    .scale(w * 1.2)
    .translate([w / 2 - 60, h / 2]);
const path = d3.geoPath(projection);

const SVG_HEADER = d3.select('.container')
    .append('svg')
    .attr('viewBox', [0, 0, w, 150]);

const SVG_IDN_MAP = d3.select('.container')
    .append('svg')
    .attr('id', 'IDNMAP')
    // .attr('width', 1000)
    // .attr('height', 400)
    .attr('viewBox', [-115, 0, 1400, 530]);

SVG_HEADER.append('text')
    .attr('x', w / 2)
    .attr('y', margin.top * 2)
    .attr('text-anchor', 'middle')
    .attr('id', 'title')
    .style('font-size', '2em')
    .style('font-weight', 'bold')
    .text('Indonesia Realtime COVID19 Data');

const getCOVID = axios.get(urlCOVID);
const gettopoIDN = axios.get(urltopoIDN);

Promise.all([getCOVID, gettopoIDN])
    .then(results => {
        const covidData = results[0].data.data;
        const topoIDN = results[1].data;
        console.log('getCOVID', covidData);
        console.log('gettopoIDN', topoIDN);

        // education data simplified only 'id' and 'bachelorsOrHigher' data.
        const data = {};
        covidData.forEach(item => {
            if (item.provinsi === 'DKI Jakarta') item.provinsi = 'Jakarta';
            if (item.provinsi === 'Daerah Istimewa Yogyakarta') item.provinsi = 'Yogyakarta';

            data[item.provinsi] = {
                kasusPosi: item['kasusPosi'],
                kasusMeni: item['kasusMeni'],
                kasusSemb: item['kasusSemb']
            };
        });
        console.log('covidData formatted', data);

        const domain = d3.extent(covidData, d => d.kasusPosi);
        console.log('domain', domain)
        const interpolateScale = d3.scaleLinear(domain, [0, 1]); // experimental color

        console.log('feature', topojson.feature(topoIDN, topoIDN.objects.provinces))
        console.log('mesh', topojson.mesh(topoIDN, topoIDN.objects.provinces, (a, b) => a !== b))
        let provinsiFromTopo = [];

        // provinsi path
        SVG_IDN_MAP.append('g')
            .selectAll('path')
            .data(topojson.feature(topoIDN, topoIDN.objects.provinces).features)
            .join('path')
            .attr('class', 'provinsi')
            .attr('fill', d => {
                provinsiFromTopo.push(d.properties['provinsi']);
                return d3.interpolateWarm(interpolateScale(data[`${d.properties['provinsi']}`].kasusPosi)) // experimental color
            }).attr('d', path)
            .on('mouseover', (d, i) => {
                const tooltip = document.querySelector('#tooltip');
                const provinsi = d.properties['provinsi'];
                tooltip.style.opacity = 0.8;
                tooltip.style.left = d3.event.pageX + 10;
                tooltip.style.top = d3.event.pageY - 10;
                tooltip.innerHTML = `${provinsi}, 
                <br>Confirmed: ${data[provinsi].kasusPosi} 
                <br>Death: ${data[provinsi].kasusMeni}
                <br>Recovered: ${data[provinsi].kasusSemb}`
            })
            .on('mouseout', (d, i) => {
                const tooltip = document.querySelector('#tooltip');
                tooltip.style.opacity = 0;
                tooltip.style.right = 0;
                tooltip.style.top = 0;
            });
        let provinsiFromCOVID = Object.keys(data);
        console.log('provinsiFromTopo', provinsiFromTopo);
        console.log('provinsiFromCOVID', provinsiFromCOVID);
        console.log('ada di provinsiCOVID tapi gak ada di provinsiTopo', provinsiFromCOVID.filter(item => {
            return !provinsiFromTopo.includes(item)
        }));
        console.log('ada di provinsiTopo tapi gak ada di provinsiCOVID', provinsiFromTopo.filter(item => {
            return !provinsiFromCOVID.includes(item)
        }));

        // ramp template from https://observablehq.com/@d3/color-legend
        function ramp(color, n = 256) {
            const canvas = document.createElement('canvas')
            canvas.setAttribute('width', n)
            canvas.setAttribute('height', 1);
            const context = canvas.getContext("2d");
            for (let i = 0; i < n; ++i) {
                context.fillStyle = color(i / (n - 1));
                context.fillRect(i, 0, 1, 1);
            }
            return canvas;
        }

        // legend template from https://observablehq.com/@d3/color-legend 
        function legend({
            color,
            title,
            tickSize = 6,
            width = 320,
            height = 44 + tickSize,
            marginTop = 18,
            marginRight = 0,
            marginBottom = 16 + tickSize,
            marginLeft = 0,
            ticks = width / 64,
            tickFormat,
            tickValues
        } = {}) {

            const svg = d3.create("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", [0, 0, width, height])
                .style("overflow", "visible")
                .style("display", "block")
                .attr('id', 'legend');

            let tickAdjust = g => g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);
            let x;

            // Continuous
            if (color.interpolate) {
                const n = Math.min(color.domain().length, color.range().length);

                x = color.copy().rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n));

                svg.append("image")
                    .attr("x", marginLeft)
                    .attr("y", marginTop)
                    .attr("width", width - marginLeft - marginRight)
                    .attr("height", height - marginTop - marginBottom)
                    .attr("preserveAspectRatio", "none")
                    .attr("xlink:href", ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL());
            }

            // Sequential
            else if (color.interpolator) {
                x = Object.assign(color.copy()
                    .interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
                    { range() { return [marginLeft, width - marginRight]; } });

                svg.append("image")
                    .attr("x", marginLeft)
                    .attr("y", marginTop)
                    .attr("width", width - marginLeft - marginRight)
                    .attr("height", height - marginTop - marginBottom)
                    .attr("preserveAspectRatio", "none")
                    .attr("xlink:href", ramp(color.interpolator()).toDataURL());

                // scaleSequentialQuantile doesn’t implement ticks or tickFormat.
                if (!x.ticks) {
                    if (tickValues === undefined) {
                        const n = Math.round(ticks + 1);
                        tickValues = d3.range(n).map(i => d3.quantile(color.domain(), i / (n - 1)));
                    }
                    if (typeof tickFormat !== "function") {
                        tickFormat = d3.format(tickFormat === undefined ? ",f" : tickFormat);
                    }
                }
            }

            // Threshold
            else if (color.invertExtent) {
                const thresholds
                    = color.thresholds ? color.thresholds() // scaleQuantize
                        : color.quantiles ? color.quantiles() // scaleQuantile
                            : color.domain(); // scaleThreshold

                const thresholdFormat
                    = tickFormat === undefined ? d => d
                        : typeof tickFormat === "string" ? d3.format(tickFormat)
                            : tickFormat;

                x = d3.scaleLinear()
                    .domain([-1, color.range().length - 1])
                    .rangeRound([marginLeft, width - marginRight]);

                svg.append("g")
                    .selectAll("rect")
                    .data(color.range())
                    .join("rect")
                    .attr("x", (d, i) => x(i - 1))
                    .attr("y", marginTop)
                    .attr("width", (d, i) => x(i) - x(i - 1))
                    .attr("height", height - marginTop - marginBottom)
                    .attr("fill", d => d);

                tickValues = d3.range(thresholds.length);
                tickFormat = i => thresholdFormat(thresholds[i], i);
            }

            // Ordinal
            else {
                x = d3.scaleBand()
                    .domain(color.domain())
                    .rangeRound([marginLeft, width - marginRight]);

                svg.append("g")
                    .selectAll("rect")
                    .data(color.domain())
                    .join("rect")
                    .attr("x", x)
                    .attr("y", marginTop)
                    .attr("width", Math.max(0, x.bandwidth() - 1))
                    .attr("height", height - marginTop - marginBottom)
                    .attr("fill", color);

                tickAdjust = () => { };
            }

            svg.append("g")
                .attr("transform", `translate(0, ${height - marginBottom})`)
                .call(d3.axisBottom(x)
                    .ticks(ticks, typeof tickFormat === "string" ? tickFormat : undefined)
                    .tickFormat(typeof tickFormat === "function" ? tickFormat : undefined)
                    .tickSize(tickSize)
                    .tickValues(tickValues))
                .call(tickAdjust)
                .call(g => g.select(".domain").remove())
                .call(g => g.append("text")
                    .attr("x", marginLeft)
                    .attr("y", marginTop + marginBottom - height - 6)
                    .attr("fill", "currentColor")
                    .attr("text-anchor", "start")
                    .attr("font-weight", "bold")
                    .text(title));

            return svg.node();
        }

        const p = Math.max(0, d3.precisionFixed(0.05) - 2),
            legendScale = d3.scaleSequential(domain, d3.interpolateWarm); // experimental color
        SVG_IDN_MAP.append('g')
            .attr('transform', `translate(850, 0)`)
            .append(() => legend({ color: legendScale, width: 260, title: 'Confirmed COVID19 Cases (Person)' }));
    });
