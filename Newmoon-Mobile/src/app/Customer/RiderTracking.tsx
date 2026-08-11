import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, AppState, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../../lib/api';

interface RiderInfo {
  id: number;
  name: string;
  phone?: string;
}

function toLat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toLng(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

const GENERATE_MAP_HTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0}
    html,body{height:100%;width:100%;overflow:hidden;background:#f3f4f6}
    #map{height:100%;width:100%;background:#f3f4f6}
    .route-line{stroke:#1E40AF;stroke-width:8;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 4px rgba(30,64,175,0.2))}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
  (function(){
    function initMap(){
      try{
        var map=L.map('map',{zoomControl:true,attributionControl:true}).setView([14.56,121.02],15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'\\u00a9 OpenStreetMap'}).addTo(map);
        window.map=map;
        window.riderMarker=null;
        window.destMarker=null;
        window.activeRoute=null;
        window.riderPos=null;
        window.destPos=null;
        window.__autoFollow=true;
        window.__fullRouteCoords=null;
        window.__routeCacheKey=null;
        window.__isDragging=false;
        window.__pendingUpdate=null;
        window.routeRetryCount=0;
        window.maxRouteRetries=3;
        window.lastRouteFetchTime=0;
        window.minRouteFetchInterval=2000;

        var riderIcon=L.divIcon({
          html:'<div style="width:36px;height:36px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/></svg></div>',
          iconSize:[36,36],iconAnchor:[18,18],className:''
        });

        function makeDestIcon(){
          return L.divIcon({
            html:'<div style="width:24px;height:24px;background:#EF4444;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(239,68,68,0.4);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
            iconSize:[24,24],iconAnchor:[12,12],className:''
          });
        }

        function findNearestPointOnRoute(routeCoords,lat,lng){
          if(!routeCoords||routeCoords.length<2)return null;
          var minDist=Infinity,nearestPoint=null,nearestIndex=0;
          for(var i=0;i<routeCoords.length;i++){
            var p=routeCoords[i];
            var d=Math.pow(p[0]-lat,2)+Math.pow(p[1]-lng,2);
            if(d<minDist){minDist=d;nearestPoint=p;nearestIndex=i;}
          }
          return{point:nearestPoint,index:nearestIndex};
        }

        function showRoute(coords){
          if(!coords||coords.length<2){
            if(window.riderPos&&window.destPos)coords=[[window.riderPos.lat,window.riderPos.lng],[window.destPos.lat,window.destPos.lng]];
            else return;
          }
          if(window.activeRoute)window.map.removeLayer(window.activeRoute);
          window.activeRoute=L.polyline(coords,{color:'#1E40AF',weight:8,opacity:0.85,smoothFactor:1,lineJoin:'round',lineCap:'round',className:'route-line'}).addTo(map);
        }

        function updateRouteDisplay(currentIndex){
          var fullCoords=window.__fullRouteCoords;
          if(!fullCoords||fullCoords.length===0)return;
          var remaining=fullCoords.slice(currentIndex);
          if(remaining.length<2){
            if(window.riderPos&&window.destPos)remaining=[[window.riderPos.lat,window.riderPos.lng],[window.destPos.lat,window.destPos.lng]];
            else return;
          }
          if(window.activeRoute)window.map.removeLayer(window.activeRoute);
          window.activeRoute=L.polyline(remaining,{color:'#1E40AF',weight:8,opacity:0.85,smoothFactor:1,lineJoin:'round',lineCap:'round',className:'route-line'}).addTo(map);
        }

        function fetchRouteWithRetry(fromLat,fromLng,toLat,toLng,retryCount){
          retryCount=retryCount||0;
          var endpoints=['https://router.project-osrm.org/route/v1/driving/','https://routing.openstreetmap.de/routed-car/route/v1/driving/'];
          var endpoint=endpoints[retryCount%endpoints.length];
          var url=endpoint+fromLng+','+fromLat+';'+toLng+','+toLat+'?geometries=geojson&overview=full&alternatives=true&steps=true';
          fetch(url).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
            .then(function(data){
              window.routeRetryCount=0;
              if(data.code==='Ok'&&data.routes&&data.routes.length>0){
                var best=data.routes[0];
                for(var i=1;i<data.routes.length;i++){if(data.routes[i].distance<best.distance)best=data.routes[i];}
                var coords=best.geometry.coordinates.map(function(c){return[c[1],c[0]];});
                window.__fullRouteCoords=coords;
                window.__routeCacheKey=fromLat+','+fromLng+'|'+toLat+','+toLng;
                window.lastRouteFetchTime=Date.now();
                if(!window.__isDragging)showRoute(coords);
                else window.__pendingUpdate=coords;
              }else if(retryCount<window.maxRouteRetries){
                setTimeout(function(){fetchRouteWithRetry(fromLat,fromLng,toLat,toLng,retryCount+1);},1000);
              }else fallbackRoute(fromLat,fromLng,toLat,toLng);
            }).catch(function(){
              if(retryCount<window.maxRouteRetries){
                setTimeout(function(){fetchRouteWithRetry(fromLat,fromLng,toLat,toLng,retryCount+1);},1000);
              }else fallbackRoute(fromLat,fromLng,toLat,toLng);
            });
        }

        function fallbackRoute(fromLat,fromLng,toLat,toLng){
          var coords=[],steps=20;
          for(var i=0;i<=steps;i++){
            var t=i/steps;
            var offset=Math.sin(t*Math.PI)*0.001;
            coords.push([fromLat+(toLat-fromLat)*t+offset,fromLng+(toLng-fromLng)*t]);
          }
          window.__fullRouteCoords=coords;
          if(!window.__isDragging)showRoute(coords);
          else window.__pendingUpdate=coords;
        }

        function fetchRoute(fromLat,fromLng,toLat,toLng){
          var now=Date.now();
          if(now-window.lastRouteFetchTime<window.minRouteFetchInterval)return;
          fetchRouteWithRetry(fromLat,fromLng,toLat,toLng,0);
        }

        map.on('dragstart',function(){window.__isDragging=true;window.__autoFollow=false;});
        map.on('dragend',function(){
          window.__isDragging=false;
          if(window.__pendingUpdate){showRoute(window.__pendingUpdate);window.__pendingUpdate=null;}
        });

        window.__enableFollow=function(){
          window.__autoFollow=true;window.__isDragging=false;
          if(window.riderPos)map.setView([window.riderPos.lat,window.riderPos.lng],map.getZoom(),{animate:true});
        };

        window.__lastPanLat=null;
        window.__lastPanLng=null;
        window.__panThreshold=0.00005;

        function haversineMeters(lat1,lng1,lat2,lng2){
          var R=6371000;
          var dLat=(lat2-lat1)*Math.PI/180;
          var dLng=(lng2-lng1)*Math.PI/180;
          var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
          return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        }

        window.__updateRider=function(lat,lng){
          if(!map)return;
          var shouldPan=function(newLat,newLng){
            if(!window.__autoFollow||window.__isDragging)return false;
            if(window.__lastPanLat===null)return true;
            return haversineMeters(window.__lastPanLat,window.__lastPanLng,newLat,newLng)>5;
          };
          var doPan=function(newLat,newLng){
            window.__lastPanLat=newLat;
            window.__lastPanLng=newLng;
            map.panTo([newLat,newLng],{animate:true,duration:0.5});
          };
          if(window.__fullRouteCoords&&window.__fullRouteCoords.length>=2){
            var nearest=findNearestPointOnRoute(window.__fullRouteCoords,lat,lng);
            if(nearest&&nearest.point){
              window.riderPos={lat:nearest.point[0],lng:nearest.point[1]};
              if(window.riderMarker)window.riderMarker.setLatLng([nearest.point[0],nearest.point[1]]);
              else window.riderMarker=L.marker([nearest.point[0],nearest.point[1]],{icon:riderIcon}).addTo(map);
              if(shouldPan(nearest.point[0],nearest.point[1]))doPan(nearest.point[0],nearest.point[1]);
              if(!window.__isDragging)updateRouteDisplay(nearest.index);
              return;
            }
          }
          window.riderPos={lat:lat,lng:lng};
          if(window.riderMarker)window.riderMarker.setLatLng([lat,lng]);
          else window.riderMarker=L.marker([lat,lng],{icon:riderIcon}).addTo(map);
          if(shouldPan(lat,lng))doPan(lat,lng);
          if(window.destPos&&!window.__isDragging){
            var key=lat+','+lng+'|'+window.destPos.lat+','+window.destPos.lng;
            if(window.__routeCacheKey!==key)fetchRoute(lat,lng,window.destPos.lat,window.destPos.lng);
          }
        };

        window.__initDestination=function(lat,lng,address){
          window.destPos={lat:lat,lng:lng};
          if(window.destMarker)window.destMarker.setLatLng([lat,lng]);
          else window.destMarker=L.marker([lat,lng],{icon:makeDestIcon()}).addTo(map).bindPopup('<b>Delivery</b><br>'+(address||''));
          if(window.riderPos&&!window.__isDragging){
            var key=window.riderPos.lat+','+window.riderPos.lng+'|'+lat+','+lng;
            if(window.__routeCacheKey!==key)fetchRoute(window.riderPos.lat,window.riderPos.lng,lat,lng);
          }
        };

        window.__fitBounds=function(){
          var bounds=[];
          if(window.riderPos)bounds.push([window.riderPos.lat,window.riderPos.lng]);
          if(window.destPos)bounds.push([window.destPos.lat,window.destPos.lng]);
          if(bounds.length>0)map.fitBounds(bounds,{padding:[60,60],maxZoom:16});
        };

        setTimeout(function(){map.invalidateSize();},300);
        setTimeout(function(){map.invalidateSize();},600);
      }catch(e){console.error('Map init error:',e);}
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initMap);
    else initMap();
  })();
  </script>
</body>
</html>`;

export default function RiderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const webViewRef = useRef<WebView>(null);
  const [rider, setRider] = useState<RiderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [orderStatus, setOrderStatus] = useState('picked_up');
  const noId = !id;

  const mapHtmlRef = useRef<string>(GENERATE_MAP_HTML());
  const mapReadyRef = useRef(false);
  const riderRef = useRef<RiderInfo | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderLoadedRef = useRef(false);
  const lastOrderFetchRef = useRef(0);
  const riderPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const destPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const injectJS = (js: string) => {
    webViewRef.current?.injectJavaScript(js);
  };

  const fetchOrderDetails = async () => {
    if (!id) return;
    try {
      const orderRes = await api.get(`/customer/orders/${id}`);
      const addr = orderRes.data.delivery_address || '';
      setDeliveryAddress(addr);
      if (orderRes.data.status) {
        setOrderStatus(orderRes.data.status);
      }
      const dLat = toLat(orderRes.data.delivery_latitude);
      const dLng = toLng(orderRes.data.delivery_longitude);
      if (dLat && dLng) {
        destPosRef.current = { lat: dLat, lng: dLng };
        if (mapReadyRef.current) {
          injectJS(`if(window.__initDestination){window.__initDestination(${dLat},${dLng},'${addr.replace(/'/g, "\\'")}')}true;`);
          if (riderPosRef.current) {
            setTimeout(() => {
              injectJS(`if(window.__fitBounds){window.__fitBounds()}true;`);
            }, 500);
          }
        }
      }
    } catch {}
  };

  const fetchTracking = async () => {
    if (!id) return;
    try {
      const trackRes = await api.get(`/customer/orders/${id}/track`);
      const riderData = trackRes.data.rider;

      if (riderData && (!riderRef.current || riderData.id !== riderRef.current.id)) {
        riderRef.current = riderData;
        setRider(riderData);
      }

      const lat = toLat(trackRes.data.latitude);
      const lng = toLng(trackRes.data.longitude);
      setUpdatedAt(trackRes.data.updated_at);

      if (lat !== null && lng !== null) {
        if (!hasLocation) setHasLocation(true);
        riderPosRef.current = { lat, lng };
        setIsLive(true);

        if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
        liveTimerRef.current = setTimeout(() => setIsLive(false), 5000);

        if (mapReadyRef.current) {
          injectJS(`if(window.__updateRider){window.__updateRider(${lat},${lng})}true;`);

          if (destPosRef.current) {
            injectJS(`if(window.__initDestination){window.__initDestination(${destPosRef.current.lat},${destPosRef.current.lng},'${(deliveryAddress || '').replace(/'/g, "\\'")}')}true;`);
          }
        }
      }

      const now = Date.now();
      if (now - lastOrderFetchRef.current > 10000) {
        lastOrderFetchRef.current = now;
        await fetchOrderDetails();
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('No rider assigned yet');
      } else if (!hasLocation) {
        setError('Unable to load tracking');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchTracking();
    const interval = setInterval(fetchTracking, 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchTracking();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (!mapReadyRef.current || !webViewRef.current) return;
    injectJS('if(window.__enableFollow){window.__enableFollow()}true;');
    if (destPosRef.current && riderPosRef.current) {
      injectJS(`if(window.__initDestination){window.__initDestination(${destPosRef.current.lat},${destPosRef.current.lng},'${(deliveryAddress || '').replace(/'/g, "\\'")}')}true;`);
      setTimeout(() => {
        injectJS(`if(window.__fitBounds){window.__fitBounds()}true;`);
      }, 500);
    }
  }, [mapLoaded]);

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (noId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Track Order</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6 bg-gray-50">
          <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="locate-outline" size={40} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">No Order Selected</Text>
          <Text className="text-gray-500 text-center mt-2 leading-5">
            Go to an active order in your history to track your rider in real-time.
          </Text>
          <TouchableOpacity className="mt-8 bg-yellow-400 px-8 py-3.5 rounded-2xl shadow-md" onPress={() => router.back()}>
            <Text className="text-yellow-900 font-bold text-base">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 mt-4 text-sm font-medium">Fetching delivery details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Track Order</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6 bg-gray-50">
          <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
            <Ionicons name="person-outline" size={40} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">No Rider Assigned</Text>
          <Text className="text-gray-500 text-center mt-2 leading-5">
            We are currently looking for a rider. You will be notified as soon as one accepts your order.
          </Text>
          <TouchableOpacity className="mt-8 bg-yellow-400 px-8 py-3.5 rounded-2xl shadow-md" onPress={() => router.back()}>
            <Text className="text-yellow-900 font-bold text-base">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header - Like the image */}
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <View>
              <View className="flex-row items-center">
                <Text className="text-lg font-extrabold text-gray-900">Track Order #{id}</Text>
                <View className="ml-2 bg-green-500 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-[10px] font-bold">LIVE</Text>
                </View>
              </View>
              <View className="flex-row items-center mt-0.5">
                <Text className="text-xs text-gray-400 font-medium">
                  Updated {formatTime(updatedAt)}
                </Text>
                {isLive && hasLocation && (
                  <View className="flex-row items-center ml-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                    <Text className="text-green-600 text-[10px] font-bold">LIVE</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Re-center button - Like the image */}
        <TouchableOpacity
          className="mt-3 bg-blue-600 px-4 py-2.5 rounded-full flex-row items-center justify-center shadow-sm self-start"
          onPress={() => injectJS('if(window.__enableFollow){window.__enableFollow()}true;')}
        >
          <Ionicons name="locate" size={16} color="#FFFFFF" />
          <Text className="text-white text-xs font-bold ml-2">Re-center on Rider</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View className="flex-1">
        {!mapLoaded && (
          <View className="absolute inset-0 items-center justify-center bg-gray-100 z-10">
            <ActivityIndicator size="large" color="#F59E0B" />
          </View>
        )}

        <WebView
          ref={webViewRef}
          style={{ flex: 1, backgroundColor: '#f3f4f6' }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          source={{ html: mapHtmlRef.current }}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          onLoadEnd={() => {
            setMapLoaded(true);
            mapReadyRef.current = true;
            setTimeout(() => {
              injectJS('if(window.map){window.map.invalidateSize()}true;');
              fetchOrderDetails();
              if (riderPosRef.current) {
                injectJS(`if(window.__updateRider){window.__updateRider(${riderPosRef.current.lat},${riderPosRef.current.lng})}true;`);
                if (destPosRef.current) {
                  setTimeout(() => {
                    injectJS(`if(window.__fitBounds){window.__fitBounds()}true;`);
                  }, 800);
                }
              }
            }, 300);
          }}
        />

        {!hasLocation && mapLoaded && (
          <View className="absolute inset-0 bg-white/90 items-center justify-center">
            <ActivityIndicator size="large" color="#F59E0B" />
            <Text className="text-gray-900 mt-4 text-base font-bold">Waiting for signal...</Text>
            <Text className="text-gray-500 text-sm mt-1 text-center px-8 leading-5">
              The rider's location will update automatically once they start moving.
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Info Card - Like the image */}
      <View className="absolute bottom-0 left-0 right-0 p-4 pb-6">
        <View className="bg-white rounded-2xl p-4 shadow-xl">
          {/* Delivery Status */}
          <View className="mb-4">
            {(() => {
              const steps = [
                { key: 'confirmed', label: 'Confirmed', step: 1 },
                { key: 'preparing', label: 'Preparing', step: 2 },
                { key: 'ready', label: 'Ready', step: 3 },
                { key: 'picked_up', label: 'Picked Up', step: 4 },
                { key: 'out_for_delivery', label: 'On The Way', step: 5 },
                { key: 'delivered', label: 'Delivered', step: 6 },
              ];
              const currentStep = steps.find(s => s.key === orderStatus)?.step ?? 4;
              const isDelivered = orderStatus === 'delivered';
              const isCancelled = orderStatus === 'cancelled';
              return (
                <>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-500 text-[11px] font-bold tracking-widest uppercase">Delivery Status</Text>
                    <View className="flex-row items-center">
                      {isDelivered ? (
                        <>
                          <MaterialIcons name="check-circle" size={16} color="#16A34A" />
                          <Text className="text-green-600 text-sm font-bold ml-1">Order Successfully Delivered</Text>
                        </>
                      ) : isCancelled ? (
                        <>
                          <MaterialIcons name="cancel" size={16} color="#EF4444" />
                          <Text className="text-red-500 text-sm font-bold ml-1">Order Cancelled</Text>
                        </>
                      ) : (
                        <>
                          <MaterialIcons name="local-shipping" size={16} color="#3B82F6" />
                          <Text className="text-blue-600 text-sm font-bold ml-1">
                            {steps.find(s => s.key === orderStatus)?.label || 'In Progress'}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-3 px-1">
                    {steps.map((s, index) => {
                      const completed = s.step <= currentStep;
                      return (
                        <View key={s.key} className="items-center flex-1">
                          <View className={`w-6 h-6 rounded-full items-center justify-center ${completed ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <Ionicons name={completed ? 'checkmark' : 'ellipse-outline'} size={14} color="white" />
                          </View>
                          <Text className={`text-[9px] mt-1 font-medium ${completed ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</Text>
                          {index < steps.length - 1 && (
                            <View
                              className="absolute top-3 left-6 right-0 h-0.5"
                              style={{ backgroundColor: steps[index + 1].step <= currentStep ? '#86EFAC' : '#E5E7EB', right: 0 }}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              );
            })()}
          </View>

          {/* Rider Info - Like the image */}
          {rider && (
            <View className="flex-row items-center bg-gray-50 rounded-xl p-3 mb-3">
              <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center border-2 border-blue-200">
                <Text className="text-blue-600 font-extrabold text-lg">
                  {rider.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-extrabold text-base">{rider.name}</Text>
                {rider.phone ? (
                  <Text className="text-gray-500 text-xs mt-0.5">{rider.phone}</Text>
                ) : (
                  <Text className="text-gray-400 text-xs mt-0.5">No phone available</Text>
                )}
              </View>
              <TouchableOpacity
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{ backgroundColor: rider.phone ? '#007DFC' : '#D1D5DB' }}
                onPress={() => rider.phone && Linking.openURL(`tel:${rider.phone}`)}
              >
                <Ionicons name="call" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Plate and Speed - Like the image */}
          <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
            <View className="items-end">
              <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Moving at</Text>
              <Text className="text-gray-900 font-bold text-sm">0 km/h</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}