import { ZoneGroup } from '../ZoneGroup'
import { HallRoom } from './HallRoom'
import { LibraryRoom } from './LibraryRoom'
import { ShogiRoom } from './ShogiRoom'
import { DojoRoom } from './DojoRoom'
import { MissionsRoom } from './MissionsRoom'
import { CouncilRoom } from './CouncilRoom'
import { OfficeRoom } from './OfficeRoom'
import { RecruitmentRoom } from './RecruitmentRoom'
import { GardenRoom } from './GardenRoom'

export function Rooms() {
  return (
    <>
      <ZoneGroup zone="hall">
        <HallRoom />
      </ZoneGroup>
      <ZoneGroup zone="library">
        <LibraryRoom />
      </ZoneGroup>
      <ZoneGroup zone="shogi">
        <ShogiRoom />
      </ZoneGroup>
      <ZoneGroup zone="dojo">
        <DojoRoom />
      </ZoneGroup>
      <ZoneGroup zone="missions">
        <MissionsRoom />
      </ZoneGroup>
      <ZoneGroup zone="council">
        <CouncilRoom />
      </ZoneGroup>
      <ZoneGroup zone="office">
        <OfficeRoom />
      </ZoneGroup>
      <ZoneGroup zone="recruitment">
        <RecruitmentRoom />
      </ZoneGroup>
      <ZoneGroup zone="garden">
        <GardenRoom />
      </ZoneGroup>
    </>
  )
}
