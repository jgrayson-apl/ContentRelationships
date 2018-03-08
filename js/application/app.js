/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "calcite",
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/query",
  "dojo/on",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-geometry",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/portal/PortalItem",
  "esri/portal/PortalQueryParams",
  "esri/layers/Layer",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "d3"
], function (calcite, ItemHelper, UrlParamHelper, i18n, declare, Color, colors, number, query, on,
             dom, domAttr, domClass, domGeom, domConstruct,
             IdentityManager, watchUtils, promiseUtils, Portal, PortalItem, PortalQueryParams, Layer,
             Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand, d3) {

  return declare(null, {

    config: null,
    direction: null,

    /**
     *
     */
    constructor: function () {
      calcite.init();
    },

    /**
     *
     * @param boilerplateResponse
     */
    init: function (boilerplateResponse) {
      if(boilerplateResponse) {
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;

        document.documentElement.lang = boilerplateResponse.locale;

        // TITLE //
        document.title = dom.byId("app-title-node").innerHTML = this.config.title;

        // USER SIGN IN //
        this.initializeUserSignIn().then(() => {

          this.initLinks(this.portal);

          this.initializeGroupContent();
          this.initializeFolderContent();

          calcite.bus.on("tabs:active", (options) => {
            console.info(options);
            if(options.active.id === "tab-groups") {
              this.analyzeCurrentGroupContent();
            } else {
              this.analyzeCurrentFolderContent();
            }
          });

          calcite.bus.emit("drawer:open", { id: "source-drawer" });

        });

      }
    },

    /**
     * USER SIGN IN
     */
    initializeUserSignIn: function () {

      // TOGGLE SIGN IN/OUT //
      let signInNode = dom.byId("sign-in-node");
      let signOutNode = dom.byId("sign-out-node");
      let userNode = dom.byId("user-node");

      // SIGN IN //
      let userSignIn = () => {
        this.portal = new Portal({ authMode: "immediate" });
        return this.portal.load().then(() => {
          //console.info(this.portal, this.portal.user);

          dom.byId("user-firstname-node").innerHTML = this.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.portal.user.username;
          dom.byId("user-thumb-node").src = this.portal.user.thumbnailUrl;

          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");
        }).otherwise(console.warn);
      };

      // SIGN OUT //
      let userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.portal = new Portal({});
        this.portal.load().then(() => {

          this.portal.user = null;
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");

        }).otherwise(console.warn);
      };

      // CALCITE CLICK EVENT //
      on(signInNode, "click", userSignIn);
      on(signOutNode, "click", userSignOut);

      // PORTAL //
      this.portal = new Portal({});
      return this.portal.load().then(() => {
        // CHECK THE SIGN IN STATUS WHEN APP LOADS //
        return IdentityManager.checkSignInStatus(this.portal.url).always(userSignIn);
      }).otherwise(console.warn);
    },

    /**
     *
     * @private
     */
    _clearUI: function () {
      //domConstruct.empty("items-list-webmaps");
      //domConstruct.empty("items-list-layers");
      //domConstruct.empty("items-list-services");

      this.graph = { "nodes": [], "links": [] };
      this.clearGraph();
    },

    /**
     *
     */
    initializeGroupContent: function () {

      if(this.portal.user) {

        this.portal.user.fetchGroups().then((portalGroups) => {

          const groupsById = portalGroups.reduce((infos, portalGroup, portalGroupIndex) => {
            if(portalGroup.owner === this.portal.user.username) {
              infos.set(portalGroup.id, portalGroup);
              domConstruct.create("input", { className: "group-input", type: "checkbox", id: portalGroup.id }, domConstruct.create("label", { className: "esri-interactive", innerHTML: portalGroup.title }, "groups-set"));
            }
            return infos;
          }, new Map());

          query(".group-input")[0].checked = true;
          this.analyzeCurrentGroupContent = () => {
            this._clearUI();
            query(".group-input:checked").forEach((node) => {
              this.analyzeGroupContent(groupsById.get(node.id));
            });
          };
          query(".group-input").on("change", this.analyzeCurrentGroupContent);
          this.analyzeCurrentGroupContent();

        });

      }
    },

    /**
     *
     * @param portalGroup
     */
    displayGroupDetails: function (portalGroup) {
      domConstruct.empty("group-details");
      const thumbNode = domConstruct.create("span", { className: "column-2 text-center" }, "group-details");
      domConstruct.create("img", { src: portalGroup.thumbnailUrl || "./images/no_preview.gif" }, thumbNode);
      domConstruct.create("div", { className: "column-3 inline", innerHTML: `Owner: ${portalGroup.owner}` }, "group-details");
      domConstruct.create("div", { className: "column-3 inline", innerHTML: `Access: ${portalGroup.access}` }, "group-details");
      domConstruct.create("div", { className: "column-15 inline avenir-bold", innerHTML: portalGroup.snippet }, "group-details");
    },

    /**
     *
     */
    initializeFolderContent: function () {

      if(this.portal.user) {

        this.portal.user.fetchFolders().then((portalFolders) => {

          const foldersById = portalFolders.reduce((infos, portalFolder) => {
            infos.set(portalFolder.id, portalFolder);
            domConstruct.create("input", { className: "folder-input", type: "checkbox", id: portalFolder.id }, domConstruct.create("label", { className: "esri-interactive", innerHTML: portalFolder.title }, "folders-set"));
            return infos;
          }, new Map());

          query(".folder-input")[0].checked = true;
          this.analyzeCurrentFolderContent = () => {
            this._clearUI();
            query(".folder-input:checked").forEach((node) => {
              this.analyzeFolderContent(foldersById.get(node.id));
            });
          };
          query(".folder-input").on("change", this.analyzeCurrentFolderContent);

        });
      }

    },

    /**
     *
     * @param portalFolder
     */
    analyzeFolderContent: function (portalFolder) {
      const params = { num: 100, folder: portalFolder };
      this.portal.user.fetchItems(params).then((queryResults) => {
        portalFolder.type = "Folder";
        portalFolder.isContentSource = true;
        portalFolder.size = 15;
        portalFolder.order = 5;
        this.analyzeContent(portalFolder, queryResults.items).then(() => {
          this.updateGraph(this.graph);
        });
      });
    },

    /**
     *
     * @param portalGroup
     */
    analyzeGroupContent: function (portalGroup) {
      const params = new PortalQueryParams({ num: 100 });
      portalGroup.queryItems(params).then((queryResults) => {
        portalGroup.type = "Group";
        portalGroup.isContentSource = true;
        portalGroup.size = 15;
        portalGroup.order = 5;
        this.analyzeContent(portalGroup, queryResults.results).then(() => {
          this.updateGraph(this.graph);
        });
      });
    },

    /**
     *
     * @param source
     * @param items
     */
    analyzeContent: function (source, items) {

      //this.graph.nodes.push(source);

      const analyzeHandles = items.map((item) => {
        let analyzePromise = null;

        switch (true) {
          case (item.type === "Web Map") || (item.type === "Web Scene"):
            analyzePromise = item.load().then(() => {
              return this.displayWebMapItem(source, item);
            });
            //analyzePromise = this.displayWebMapItem(source, item);
            break;
          case (item.isLayer):
            analyzePromise = item.load().then(() => {
              return this.displayLayerItem(source, item);
            });
            //analyzePromise = this.displayLayerItem(source, item);
            break;
          default:
            analyzePromise = promiseUtils.resolve();
        }

        return analyzePromise;
      });

      return promiseUtils.eachAlways(analyzeHandles).then();

    },

    /**
     *
     * @param source
     * @param mapItem
     */
    displayWebMapItem: function (source, mapItem) {
      //console.info(item);

      /*domConstruct.create("div", {
        className: "webmap-info",
        innerHTML: mapItem.title
      }, "items-list-webmaps");*/

      return mapItem.fetchData().then((data) => {
        //console.info(item.title, data);
        const mapHandles = data.baseMap.baseMapLayers.map((baseMapLayer) => {
          if(baseMapLayer.url) {
            if(baseMapLayer.itemId) {
              const layerItem = new PortalItem({ id: baseMapLayer.itemId });
              return layerItem.load().then(() => {
                this.addGraphRelationships(source, baseMapLayer.url, layerItem, mapItem);
              });
            } else {
              this.addGraphRelationships(source, baseMapLayer.url, null, mapItem);
              return promiseUtils.resolve();
            }
          } else {
            return promiseUtils.resolve();
          }
        });
        const layerHandles = data.operationalLayers.map((operationalLayer) => {
          if(operationalLayer.url) {
            if(operationalLayer.itemId) {
              const layerItem = new PortalItem({ id: operationalLayer.itemId });
              return layerItem.load().then(() => {
                this.addGraphRelationships(source, operationalLayer.url, layerItem, mapItem);
              });
            } else {
              this.addGraphRelationships(source, operationalLayer.url, null, mapItem);
              return promiseUtils.resolve();
            }
          } else {
            return promiseUtils.resolve();
          }
        });

        return promiseUtils.eachAlways([...mapHandles, ...layerHandles]).then();
      });

    },

    /**
     *
     * @param source
     * @param layerItem
     */
    displayLayerItem: function (source, layerItem) {
      /*domConstruct.create("div", {
        className: "layer-info",
        innerHTML: layerItem.title
      }, "items-list-layers");*/
      if(layerItem.url) {
        this.addGraphRelationships(source, layerItem.url, layerItem);
      }
      return promiseUtils.resolve();
    },

    /**
     *
     * @param source
     * @param url
     * @param layerItem
     * @param mapItem
     */
    /*displayServiceInfo: function (source, url, layerItem, mapItem) {
      const serviceNode = domConstruct.create("div", { className: "service-info" }, "items-list-services");
      if(mapItem) {
        domConstruct.create("div", { className: "avenir-demi", innerHTML: `${mapItem.type}: ${mapItem.title}` }, serviceNode);
      }
      if(layerItem) {
        domConstruct.create("div", { className: "avenir-demi", innerHTML: `${layerItem.type}: ${layerItem.title}` }, serviceNode);
      }
      domConstruct.create("div", { innerHTML: url }, serviceNode);
      this.addGraphRelationships(source, url, layerItem, mapItem);
    },*/

    /**
     *
     * @param id
     * @returns {number}
     */
    getNodeIndexById: function (id) {
      return this.graph.nodes.findIndex((nodeInfo) => {
        return (nodeInfo.id === id);
      });
    },

    /**
     *
     * @param parentNodeIndex
     * @param item
     * @param size
     * @param sourceIndex
     * @returns {number}
     * @private
     */
    addGraphItem: function (parentNodeIndex, item, size, sourceIndex) {

      const isMap = (item.type === "Web Map") || (item.type === "Web Scene");

      let nodeIndex = this.getNodeIndexById(item.id);
      if(nodeIndex === -1) {
        nodeIndex = this.graph.nodes.push({
          id: item.id,
          url: item.url || item.userItemUrl,
          title: item.title,
          access: item.access,
          type: item.type,
          isPortalItem: (item.isLayer || isMap),
          order: isMap ? 4 : 3,
          iconUrl: item.iconUrl,
          owner: item.owner,
          size: size
        });
        --nodeIndex;
      }

      this.graph.links.push({ source: nodeIndex, target: parentNodeIndex, "bond": 1 });

      if(sourceIndex != null && sourceIndex > -1) {
        this.graph.links.push({ source: sourceIndex, target: nodeIndex, "bond": 2 });
      }

      return nodeIndex;
    },

    /**
     *
     * @param source
     * @param url
     * @param layerItem
     * @param mapItem
     */
    addGraphRelationships: function (source, url, layerItem, mapItem) {

      const sourceIndex = this.getNodeIndexById(source.id);

      const urlParser = new URL(url);

      const serverOrigin = urlParser.origin;
      let serverNodeIndex = this.getNodeIndexById(serverOrigin);
      if(serverNodeIndex === -1) {
        serverNodeIndex = this.graph.nodes.push({ id: serverOrigin, url: serverOrigin, title: serverOrigin, size: 4, type: "Server", order: 1 });
        --serverNodeIndex;
      }

      let serviceNodeIndex = this.getNodeIndexById(url);
      if(serviceNodeIndex === -1) {

        const serviceName = urlParser.pathname;
        const restServices = "/rest/services/";
        const serviceTitle = serviceName.slice(serviceName.indexOf(restServices) + restServices.length);

        serviceNodeIndex = this.graph.nodes.push({ id: url, url: url, title: serviceTitle, size: 5, type: "Service", order: 2 });
        --serviceNodeIndex;
        this.graph.links.push({ source: serviceNodeIndex, target: serverNodeIndex, "bond": 1 });
      }

      if(layerItem && mapItem) {
        const layerNodeIndex = this.addGraphItem(serviceNodeIndex, layerItem, 7);
        this.addGraphItem(layerNodeIndex, mapItem, 10, sourceIndex);
      } else {
        if(layerItem) {
          this.addGraphItem(serviceNodeIndex, layerItem, 7, sourceIndex);
        } else {
          if(mapItem) {
            this.addGraphItem(serviceNodeIndex, mapItem, 10, sourceIndex);
          } else {
            console.warn("We should NEVER get here...");
          }
        }
      }
    },

    /**
     *  https://github.com/d3/d3-3.x-api-reference/blob/master/Force-Layout.md
     *
     *  https://bl.ocks.org/mbostock
     *
     *  https://gist.github.com/sathomas/1ca23ee9588580d768aa
     *  http://www.coppelia.io/2014/07/an-a-to-z-of-extra-features-for-the-d3-force-layout/
     *  http://mbostock.github.io/d3/talk/20111116/force-collapsible.html
     *  http://mbostock.github.io/d3/talk/20111018/tree.html
     *  https://bl.ocks.org/jpurma/6dd2081cf25a5d2dfcdcab1a4868f237
     *  https://bl.ocks.org/mbostock/1093130
     */
    initLinks: function (portal) {

      const nodeGeom = domGeom.getContentBox("links-node");
      const width = nodeGeom.w;
      const height = nodeGeom.h;

      const color = d3.scale.category20();
      const radius = d3.scale.sqrt().range([0, 6]);

      const svg = d3.select("#links-node").append("svg").attr("width", width).attr("height", height);

      const force = d3.layout.force().size([width, height]).charge(-150).linkDistance(function (d) {
        return (radius(d.source.order) + radius(d.target.order) * 5) + 15;
      });//.gravity(0.1);

      this.clearGraph = () => {
        svg.selectAll('*').remove();
        query("#graph-legend").empty();
      };

      this.updateGraph = (graph) => {
        svg.selectAll('*').remove();

        force.nodes(graph.nodes).links(graph.links).on("tick", tick).start();

        svg.append("defs").selectAll("marker").data(["suit"]).enter().append("marker").attr("id", function (d) {
          return d;
        }).attr("viewBox", "0 -5 10 10").attr("refX", 25).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5 L10,0 L0, -5").style("stroke", "#fff").style("opacity", "0.6");

        let link = svg.selectAll(".link").data(graph.links).enter().append("g").attr("class", "link").style("marker-end", "url(#suit)");

        link.append("line").style("stroke-width", function (d) {
          return "2px";
        });
        link.filter(function (d) {
          return d.bond > 1;
        }).append("line").attr("class", "separator");


        const node = svg.selectAll(".node").data(graph.nodes).enter().append("g").attr("class", "node").on("mouseover", mouseover).on("mouseout", mouseout).on('dblclick', connectedNodes).call(force.drag);


        const typeColors = new Map();
        node.append("circle").attr("r", function (d) {
          return radius(d.size);
        }).style("fill", function (d) {
          if(d.iconUrl) {
            domConstruct.create("img", { src: d.iconUrl, className: "margin-right-quarter" });
          }
          const itemColor = color(d.type);
          if(!typeColors.has(d.type)) {
            typeColors.set(d.type, { color: itemColor, iconUrl: d.iconUrl });
          }
          return itemColor;
        }).style("stroke", function (d) {
          const defaultStoke = "#0079c1";
          if(d.type === "Server") {
            const serverUrl = new URL(d.url);
            return (serverUrl.protocol === "https:") ? defaultStoke : "red";
          } else {
            return defaultStoke;
          }
        });
        this.buildGraphLegend(typeColors);

        node.filter(function (d) {
          return (d.iconUrl != null);
        }).append("image").attr("x", -8).attr("y", -8).attr("xlink:href", function (d) {
          return d.iconUrl;
        });

        node.append("text").attr("dy", function (d) {
          return d.iconUrl ? "-12px" : "0"; // "0.35em";
        }).attr("text-anchor", "middle").text(function (d) {
          return d.title;
        });

        function tick(e) {
          const k = 6 * e.alpha;

          // Push sources up and targets down to form a weak tree.
          /*link.each(function (d) {
            d.source.y -= k;
            d.target.y += k;
          }).attr("x1", function (d) {
            return d.source.x;
          }).attr("y1", function (d) {
            return d.source.y;
          }).attr("x2", function (d) {
            return d.target.x;
          }).attr("y2", function (d) {
            return d.target.y;
          });
          node.attr("cx", function (d) {
            return d.x;
          }).attr("cy", function (d) {
            return d.y;
          });*/


          link.selectAll("line").attr("x1", function (d) {
            return d.source.x;
          }).attr("y1", function (d) {
            return d.source.y;
          }).attr("x2", function (d) {
            return d.target.x;
          }).attr("y2", function (d) {
            return d.target.y;
          });
          node.attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
          });

        }

        function mouseover() {
          // d3.select(this).select("text").transition().duration(750).style("opacity", 1).style("font-size", "17pt");
        }

        function mouseout() {
          // d3.select(this).select("text").transition().duration(250).style("opacity", 0.65).style("font-size", "9pt");
        }

        let toggle = 0;
        const linkedByIndex = {};
        for (i = 0; i < graph.nodes.length; i++) {
          linkedByIndex[i + "," + i] = 1;
        }

        graph.links.forEach(function (d) {
          linkedByIndex[d.source.index + "," + d.target.index] = 1;
        });

        function neighboring(a, b) {
          return linkedByIndex[a.index + "," + b.index];
        }

        function connectedNodes() {
          if(toggle === 0) {
            const d = d3.select(this).node().__data__;

            const itemLineageIDs = displayTraceItems(d);
            //createSelectionGraph(itemLineageIDs);

            node.style("opacity", function (o) {
              return itemLineageIDs.includes(o.id) ? 1 : 0.1;
            });
            node.selectAll("text").style("opacity", function (o) {
              return itemLineageIDs.includes(o.id) ? 1 : 0.1;
            });
            link.style("opacity", function (o) {
              return (itemLineageIDs.includes(o.source.id) && itemLineageIDs.includes(o.target.id)) ? 1 : 0.1;
            });
            toggle = 1;
          } else {
            displayTraceItems();
            node.selectAll("text").style("opacity", 0.65);
            node.style("opacity", 1);
            link.style("opacity", 1);
            toggle = 0;
          }
        }

        /**
         * https://bl.ocks.org/mbostock/2949981
         * http://bl.ocks.org/trembl/9263485
         *
         * @param itemLineageIDs
         */
        function createSelectionGraph(itemLineageIDs) {


          query("#tree-node").empty();
          const treeNodeGeom = domGeom.getContentBox("tree-node");
          const margin = { top: 20, right: 20, bottom: 20, left: 50 };
          const treeWidth = treeNodeGeom.w - margin.left - margin.right;
          const treeHeight = treeNodeGeom.h - margin.top - margin.bottom;

          const tree = d3.layout.tree().size([treeHeight, treeWidth]);
          const diagonal = d3.svg.diagonal().projection(function (d) {
            return [d.y, d.x];
          });

          const treeSvg = d3.select("#tree-node").append("svg")
              .attr("width", treeWidth + margin.left + margin.right)
              .attr("height", treeHeight + margin.top + margin.bottom)
              .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


          const selectedGraph = {
            nodes: graph.nodes.filter((nodeInfo) => {
              return itemLineageIDs.includes(nodeInfo.id);
            }),
            links: graph.links.filter((linkInfo) => {
              return (itemLineageIDs.includes(linkInfo.source.id) && itemLineageIDs.includes(linkInfo.target.id));
            })
          };

          selectedGraph.links.forEach(function (link) {
            if(link.source.children) {
              link.source.children.push({ ...link.target });
            } else {
              link.source.children = [{ ...link.target }];
            }
          });

          const duration = 750;
          const root = { id: "root", title: "root", children: selectedGraph.nodes, x0: height / 2, y0: 0 };

          function collapse(d) {
            if(d.children) {
              d._children = d.children;
              d._children.forEach(collapse);
              d.children = null;
            }
          }
          root.children.forEach(collapse);

          update(root);


          function update(source) {

            // Compute the new tree layout.
            const treeNodes = tree.nodes(root).reverse();
            const treeLinks = tree.links(treeNodes);

            // Normalize for fixed-depth.
            treeNodes.forEach(function (d) {
              d.y = d.depth * 350;
            });

            // Update the nodes…
            const treeNode = treeSvg.selectAll("g.node").data(treeNodes, function (d) {
              return d.uid || (d.uid = ++i);
            });

            // Enter any new nodes at the parent's previous position.
            const nodeEnter = treeNode.enter().append("g").attr("class", "node").attr("transform", function (d) {
              return "translate(" + source.y0 + "," + source.x0 + ")";
            }).on("click", click);

            nodeEnter.append("circle").attr("r", 1e-6).style("fill", function (d) {
              return d._children ? "lightsteelblue" : "#fff";
            });

            nodeEnter.append("text").attr("x", function (d) {
              return d.children || d._children ? -10 : 10;
            }).attr("dy", ".35em").attr("text-anchor", function (d) {
              return d.children || d._children ? "end" : "start";
            }).text(function (d) {
              return d.title;
            }).style("fill-opacity", 1e-6);

            // Transition nodes to their new position.
            const nodeUpdate = treeNode.transition().duration(duration).attr("transform", function (d) {
              return "translate(" + d.y + "," + d.x + ")";
            });

            nodeUpdate.select("circle").attr("r", 4.5).style("fill", function (d) {
              return d._children ? "lightsteelblue" : "#fff";
            });

            nodeUpdate.select("text").style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            const nodeExit = treeNode.exit().transition().duration(duration).attr("transform", function (d) {
              return "translate(" + source.y + "," + source.x + ")";
            }).remove();

            nodeExit.select("circle").attr("r", 1e-6);

            nodeExit.select("text").style("fill-opacity", 1e-6);

            // Update the links…
            const treeLink = treeSvg.selectAll("path.link").data(treeLinks, function (d) {
              return d.target.uid;
            });

            // Enter any new links at the parent's previous position.
            treeLink.enter().insert("path", "g").attr("class", "link").attr("d", function (d) {
              const o = { x: source.x0, y: source.y0 };
              return diagonal({ source: o, target: o });
            });

            // Transition links to their new position.
            treeLink.transition().duration(duration).attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            treeLink.exit().transition().duration(duration).attr("d", function (d) {
              const o = { x: source.x, y: source.y };
              return diagonal({ source: o, target: o });
            }).remove();

            // Stash the old positions for transition.
            treeNodes.forEach(function (d) {
              d.x0 = d.x;
              d.y0 = d.y;
            });
          }

          // Toggle children on click.
          function click(d) {
            if(d.children) {
              d._children = d.children;
              d.children = null;
            } else {
              d.children = d._children;
              d._children = null;
            }
            update(d);
          }

          //const nodesByName = {};
          //function nodeByName(item) {
          //  return nodesByName[item.id] || (nodesByName[item.id] = item);
          //}

          /*const treeLinks = selectedGraph.links;
          treeLinks.forEach(function (link) {
            //const parent = link.source = nodeByName(link.source);
            //const child = link.target = nodeByName(link.target);
            //if(parent.children) parent.children.push(child);
            //else parent.children = [child];
            if(link.source.children) {
              link.source.children.push(link.target);
            } else {
              link.source.children = [link.target];
            }
          });

          const treeNodes = tree.nodes(selectedGraph.nodes);

          treeSvg.selectAll(".link").data(treeLinks).enter().append("path").attr("class", "tree-link").attr("d", diagonal);

          treeSvg.selectAll(".node").data(treeNodes).enter().append("circle").attr("class", "tree-node").attr("r", 5).attr("cx", function (d) {
            return d.y;
          }).attr("cy", function (d) {
            return d.x;
          });*/

        }

        function displayTraceItems(item) {
          query("#lineage-node").empty();
          if(item) {
            const itemLineage = _getItemLineage(item);

            itemLineage.sort((a, b) => {
              return (b.order - a.order);
            });

            return itemLineage.map((item) => {
              displayItemInfo(item);
              return item.id;
            });
          } else {
            return null;
          }
        }

        function _getItemLineage(item) {
          item.trace = "focus";
          const sourceItems = _trace(item, "target");
          const targetItems = _trace(item, "source").reverse();
          return [...sourceItems, item, ...targetItems];
        }

        function _trace(sourceItem, direction) {
          const tracedItems = new Map();

          function __recurse(item) {
            const links = _getLinksById(item.id, direction);
            if(links.length > 0) {
              links.forEach((link) => {
                __recurse(link[direction !== "source" ? "source" : "target"]);
              });
            }
            if((item.id !== sourceItem.id) && (!tracedItems.has(item.id))) {
              item.trace = direction;
              tracedItems.set(item.id, item);
            }
          }

          __recurse(sourceItem);

          return Array.from(tracedItems.values());
        }

        function _getLinksById(id, direction) {
          return graph.links.filter((linkInfo) => {
            return (linkInfo[direction].id === id);
          });
        }


        function displayItemInfo(item) {
          //console.info("displayItemInfo: ", item);

          const traceItemNode = domConstruct.create("tr", { className: "lineage-item", title: item.id }, "lineage-node");
          domClass.toggle(traceItemNode, "text-blue font-size-1", (item.trace === "focus"));

          const infoText = item.isPortalItem ? `${item.type} by <span class="avenir-demi">${item.owner}</span>` : item.type;
          const infoNode = domConstruct.create("td", { innerHTML: infoText }, traceItemNode);
          if(item.iconUrl) {
            domConstruct.create("img", { src: item.iconUrl, className: "margin-right-quarter" }, infoNode, "first");
          }

          domConstruct.create("td", { className: "margin-left-1", innerHTML: item.title }, traceItemNode);

          if(item.type === "Group") {
            const groupDetailsUrl = getGroupDetailsUrl(item);
            domConstruct.create("a", { className: "margin-left-quarter icon-ui-link-external right", href: groupDetailsUrl, target: "_blank" }, infoNode);
          }
          if(item.type === "Folder") {
            const folderDetailsUrl = getFolderDetailsUrl(item);
            domConstruct.create("a", { className: "margin-left-quarter icon-ui-link-external right", href: folderDetailsUrl, target: "_blank" }, infoNode);
          }
          if(item.isPortalItem) {
            const itemDetailsUrl = getItemDetailsUrl(item);
            domConstruct.create("a", { className: "margin-left-quarter icon-ui-link-external right", href: itemDetailsUrl, target: "_blank" }, infoNode);

            portal.queryUsers({ query: `username:${item.owner}` }).then((queryUsersResults) => {
              const itemOwner = queryUsersResults.results[0];
              if(itemOwner.email) {
                domConstruct.create("a", { className: "margin-left-quarter icon-ui-contact right", href: `mailto:${itemOwner.email}` }, infoNode);
              }
            });

          }
          if(item.type === "Service") {
            domConstruct.create("a", { className: "margin-left-quarter icon-ui-link-external right", href: item.url, target: "_blank" }, infoNode);
          }

        }

        function getItemDetailsUrl(item) {
          return `${_getPortalUrl()}/home/item.html?id=${item.id}`;
        }

        function getGroupDetailsUrl(item) {
          return `${_getPortalUrl()}/home/group.html?id=${item.id}`;
        }

        function getFolderDetailsUrl(item) {
          return `${_getPortalUrl()}/home/content.html?folder=${item.id}`;
        }

        function _getPortalUrl() {
          return portal ? (portal.urlKey ? `https://${portal.urlKey}.${portal.customBaseUrl}` : portal.url) : "https://www.arcgis.com";
        }

      };
    },

    /**
     *
     * @param colorInfos
     */
    buildGraphLegend: function (colorInfos) {
      query("#graph-legend").empty();

      colorInfos.forEach((colorInfo, type) => {

        const legendItemNode = domConstruct.create("div", { className: "graph-legend-item" }, "graph-legend");
        domConstruct.create("span", { className: "inline-block graph-legend-color", style: `background:${colorInfo.color};` }, legendItemNode);
        if(colorInfo.iconUrl) {
          domConstruct.create("img", { src: colorInfo.iconUrl, className: "margin-right-quarter" }, legendItemNode);
        }
        domConstruct.create("span", { className: "inline-block text-blue font-size--2", innerHTML: type }, legendItemNode);

      });

    }

  });
});

