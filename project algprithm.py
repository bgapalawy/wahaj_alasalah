#1-open autocad in arch gis
#2-convert plan to map and  to polygon 
#3-delete un neccessary shapes and connect the absent shapes and annotation
#4-convert to geodatabase
#5-set define projection from arcgis to platecaree
#6-features to json
#5-import as geo data frame
#6-convert it to html
#7-working with pyqt5





import geopandas as gpd
#data=gpd.read_file("E:/VILLA PROJECT/python/json/new_json_wajha_last_update1.geoJson") 
#data=gpd.read_file("E:/11/fdddd.shx")
# data=gpd.read_file("E:\VILLA PROJECT\python\wajha_data.gdb") 

# data_to_Html=data.explore()
# data_to_Html.save("wajhaaaa_HTML_NEW.html")


# #folium
# #%%
# import folium 
# import os
# m=folium.Map(location=[52,7.5],zoom_start=1,tiles=None)
# layer=folium.GeoJson('4.json').add_to(m)
# m.fit_bounds(layer.get_bounds()) 
# m


import sys   
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QApplication
from PyQt5.QtGui import QDoubleValidator
from PyQt5.QtWebEngineWidgets  import *
app=QApplication(sys.argv)
web=QWebEngineView()
web.load(QUrl.fromLocalFile("D:\My Private\VILLA_PROJECT\python\wajha_leaflet\html\wajha.html"))
web.show()
sys.exit(app.exec_())

