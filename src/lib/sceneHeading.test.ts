import { describe, expect, it } from 'vitest'
import {
  sceneHeadingTimesOfDay,
  parseSceneHeadingParts,
} from './sceneHeading'

describe('scene heading time parsing', () => {
  it.each([
    'DAY/NIGHT',
    'NIGHT/DAY',
    'EARLY MORNING',
    'LATE MORNING',
    'NOON',
    'EARLY AFTERNOON',
    'LATE AFTERNOON',
    'EARLY EVENING',
    'LATE EVENING',
    'LATE NIGHT',
    'MIDNIGHT',
    'PRE-DAWN',
    'SUNRISE',
    'SUNSET',
    'TWILIGHT',
    'GOLDEN HOUR',
    'BLUE HOUR',
  ])('recognizes %s without attaching it to the location', (time) => {
    expect(parseSceneHeadingParts(`INT. CLOCK TOWER - ${time}`)).toMatchObject({
      location: 'CLOCK TOWER',
      dayNight: time,
      timeOfDay: time,
    })
  })

  it('recognizes dotted compound time before a scene number', () => {
    expect(
      parseSceneHeadingParts('EXT. OLD PIER. DAY/NIGHT. SCENE 7'),
    ).toMatchObject({
      location: 'OLD PIER',
      timeOfDay: 'DAY/NIGHT',
    })
  })

  it('orders longer values before their suffixes', () => {
    expect(sceneHeadingTimesOfDay.indexOf('LATE NIGHT')).toBeLessThan(
      sceneHeadingTimesOfDay.indexOf('NIGHT'),
    )
  })
})
