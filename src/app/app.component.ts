import { Component, OnInit } from '@angular/core';
import axios from 'axios';

@Component({
  selector: 'app-weather',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class WeatherComponent implements OnInit {
  weatherData: any;

  constructor() { }

  ngOnInit(): void {
    this.fetchWeatherData();
  }

  fetchWeatherData(): void {
    axios.get('http://localhost:3000/api/weather')
      .then(response => {
        this.weatherData = response.data;
      })
      .catch(error => {
        console.error('Error fetching weather data:', error);
      });
  }
}
