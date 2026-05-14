<?php
include_once('header.php'); 
?>


<?
if(!$p_jumin) {
	$p_jumin = $p_jumin1.$p_jumin2;
}
if (!$p_name || !$p_jumin) {
?>
	<script>
		location.href="login.php";
	</script>
				
<?
	exit;
}
?>

<?include ("../slim/dbconn.inc");?>




<div id="s_menu">
		<ul>
			<li><a href="index.php?p_name=<?=$p_name?>&p_jumin1=<?=$p_jumin1?>&p_jumin2=<?=$p_jumin2?>" target="" >예상 연금 조회</a></li>
			<li><a href="view.php?p_name=<?=$p_name?>&p_jumin1=<?=$p_jumin1?>&p_jumin2=<?=$p_jumin2?>" target="">연금 납입내역 조회</a></li>
		</ul>
</div>



<?
//$p_name="김안중";
$p_name2= iconv("UTF-8","EUC-KR", $p_name);
//$p_name2=$p_name;
//$p_jumin="5507141646416";
?>

<?
$query = "select * from TB_MEM101 where worker_name='$p_name2' and jumin='$p_jumin'";
//echo($query);
$result = mysql_query($query);
//echo($result);
if(!$result) {
	//error("QUERY_ERROR");
	 echo("쿼리 에러");
	 echo($query);
	 exit;
}
//echo($query);

//echo( mysql_num_rows($result) );




//echo($p_birth);


if (mysql_num_rows($result) >0) {
	$data = mysql_fetch_object($result);
	$p_birth = $data->birth;
	$p_year = substr($p_birth, 0, 4);
	$p_month = substr($p_birth, 4, 2);

	$p_code =$data->worker_code;

	$query2="select PenNo from TB_PEN100 where enddate= '' and MemberCode ='$p_code'";
//	echo($query2);
	$result2 = mysql_query($query2);

	if(!$result2) {
	//error("QUERY_ERROR");
	 echo("쿼리 에러");
	 echo($query2);
	 exit;
	}

	$PenNo =mysql_result( $result2,0,0);
	$PenNo2 ="5".substr($PenNo,1,6);


} else {
?>	
		<script>
			
			alert('정확한 정보를 입력해주세요');
			history.back();
		</script>
		
<?

		exit;
}

$timeinfo = getdate(time());
$c_year = $timeinfo[year]; // 현재 년도
$c_month = $timeinfo[mon]; // 현재 월
$c_day = $timeinfo[mday]; // 현재 일
?>

<?
if ($search != 'ok') {
	$query3="select Lev1_Cnt,Lev2_Cnt, Lev3_Cnt, Lev4_Cnt from TB_PEN999 where Penno='$PenNo'";
//	echo($query3);
	$result3 = mysql_query($query3);
	if(!$result3) {
	//error("QUERY_ERROR");
	 echo("쿼리 에러");
	 echo($query3);
	 exit;
	}

	$Lev1_Cnt_db =mysql_result( $result3,0,0);
	$Lev2_Cnt_db =mysql_result( $result3,0,1);
	$Lev3_Cnt_db =mysql_result( $result3,0,2);
	$Lev4_Cnt_db =mysql_result( $result3,0,3);

   

	$Lev1_Cnt_y = ($Lev1_Cnt_db - ($Lev1_Cnt_db % 12)) / 12; 
	$Lev1_Cnt_m = $Lev1_Cnt_db % 12; 

	$Lev2_Cnt_y = ($Lev2_Cnt_db - ($Lev2_Cnt_db % 12)) / 12; 
	$Lev2_Cnt_m = $Lev2_Cnt_db % 12; 


	$Lev3_Cnt_y = ($Lev3_Cnt_db - ($Lev3_Cnt_db % 12)) / 12; 
	$Lev3_Cnt_m = $Lev3_Cnt_db % 12; 


	$Lev4_Cnt_y = ($Lev4_Cnt_db - ($Lev4_Cnt_db % 12)) / 12; 
	$Lev4_Cnt_m = $Lev4_Cnt_db % 12; 

} 
	//echo("$Lev1_Cnt_y $Lev1_Cnt_y $Lev1_Cnt_m ");
	?>

	<?
	$query4="select AMT from TB_PEN998";
	//echo($query3);
	$result4 = mysql_query($query4);
	if(!$result4) {
	//error("QUERY_ERROR");
	 echo("쿼리 에러");
	 echo($query4);
	 exit;
	}

	$AMT =mysql_result( $result4,0,0);


	?>

	
<script>
	
	function checkIt(form) {
		//alert('여기');
		form = document.signform;
/*
		if (!form.p_name.value)
		{
			alert('이름을 입력해 주세요');
			form.p_name.focus();
			return false;

		} else if (!form.p_jumin1.value) {

			alert('주민번호 앞자리를 입력해 주세요');
			form.p_jumin1.focus();
			return false;

		} else if (!form.p_jumin2.value) {

			alert('주민번호 뒷자리를 입력해 주세요');
			form.p_jumin2.focus();
			return false;

		} else {

			form.submit();
		}
		
		*/

		form.submit();


	}
</script>



<section class="scontents"  data-aos="fade-in">

	<p class="eng"><em><?=$p_name?>(<?=$p_birth?>)</em>님의 <br class="mview">예상 연금 조회	</p>
	<p class="stitle">&nbsp;<!-- 한국기독교장로회 총회 연금재단 전산조회 --></p>
<form name="signform" method="post" action="index.php">
<input type="hidden" name="search" value="ok">
<input type="hidden" name="p_name" value="<?=$p_name?>">
<input type="hidden" name="p_jumin1" value="<?=$p_jumin1?>">
<input type="hidden" name="p_jumin2" value="<?=$p_jumin2?>">

		
		
		<div class="scontentbg_lg">
			<p>* 교역자의 은퇴 후 연금 예상지급액을 조회합니다. <br>
			<span class="lview">&nbsp;&nbsp; </span>은퇴 전까지 추가납입분( 연금/특약)을 조정하여 예상지급액을 조회할 수 있습니다.</p>
			<p style="margin-top:20px;">* 지급개시년월을 변경하여 은퇴시기에 따른 예상지급액을 알아볼 수 있습니다.</p>
		</div>
		
		
		<div class="online_wrap">	

		

			<h2 class="online_title">기본 납입 정보&nbsp;&nbsp;<p> 필수 입력사항 입니다.</p></h2>
			
			<div class="online_box">
				<ul>					
					<li class="stit">연금불입</li>
					<li class="w50">

							<dl>
								<dt>
									<span>불입개월(1단계)</span>
								</dt>
								<dd>
									   <select name="Lev1_Cnt_y" required  class="required">
											<? for ($iii =0; $iii <=50; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev1_Cnt_y) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 년

										<select name="Lev1_Cnt_m" required  class="required">
											<? for ($iii =0; $iii <=12; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev1_Cnt_m) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 개월


								</dd>
							</dl>

					</li>
					<li class="w50">

							<dl>
								<dt>
									<span>불입개월(2단계)</span>
								</dt>
								<dd>
										 <select name="Lev2_Cnt_y" required  class="required">
											<? for ($iii =0; $iii <=50; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev2_Cnt_y) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 년

										<select name="Lev2_Cnt_m" required  class="required">
											<? for ($iii =0; $iii <=12; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev2_Cnt_m) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 개월
								</dd>
							</dl>

					</li>
					<li class="stit">특약불입</li>
					<li class="w50">

							<dl>
								<dt>
									<span>불입개월(3단계)</span>
								</dt>
								<dd>
									 <select name="Lev3_Cnt_y" required  class="required">
											<? for ($iii =0; $iii <=50; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev3_Cnt_y) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 년

										<select name="Lev3_Cnt_m" required  class="required">
											<? for ($iii =0; $iii <=12; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev3_Cnt_m) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 개월
								</dd>
							</dl>

					</li>
					<li class="w50">

							<dl>
								<dt>
									<span>불입개월(4단계)</span>
								</dt>
								<dd>
									 <select name="Lev4_Cnt_y" required  class="required">
											<? for ($iii =0; $iii <=50; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev4_Cnt_y) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 년

										<select name="Lev4_Cnt_m" required  class="required">
											<? for ($iii =0; $iii <=12; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$Lev4_Cnt_m) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 개월
								</dd>
							</dl>

					</li>
					<li class="txtctr">* 예정일을 입력하시면 가상의 지급정보가 나옵니다.</li>
					 

				</ul>
			</div><!--.online_box--->

		</div><!--.online_wrap-->







		<div class="online_wrap">	

			<h2 class="online_title">지급 정보&nbsp;&nbsp;<p> 지급개시 년월 입력 후 예상지급액 계산하기를 클릭해 주세요.</p></h2>
			
			<div class="online_box">
				<ul>					
					<li class="stit">연금지급</li>

					<li class="w50">

							<dl>
								<dt>
									<span>지급개시 년월</span>
								</dt>
								<dd>
									<?if (!$s_year) {
												$s_year =	$c_year;
										} 
										if (!$s_month) {
												$s_month =	$c_month;
										} 
										?>

									<select name="s_year" required  class="required">
											<? for ($iii =$c_year; $iii <=$c_year+50; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$s_year) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 년

										<select name="s_month" required  class="required">
											<? for ($iii =1; $iii <=12; $iii ++) { ?>
												<option value="<?=$iii?>" <?if ($iii ==$s_month) echo("selected");?>><?=$iii?></option>
											<? }?>
										</select> 월
								</dd>
							</dl>

					</li>

<?
if ($search =='ok') {
	
	//연급불입개월

	$s1 = floor(($Lev1_Cnt_y*12 +$Lev1_Cnt_m)/2) +($Lev2_Cnt_y*12 +$Lev2_Cnt_m); //연금불입개월 인정
	$s2 = floor(($Lev3_Cnt_y*12 +$Lev3_Cnt_m)/2) +($Lev4_Cnt_y*12 +$Lev4_Cnt_m); //특약불입개월 인정

	//echo($s1);
	//$s1_t = ($Lev1_Cnt_y*12 +$Lev1_Cnt_m) +($Lev2_Cnt_y*12 +$Lev2_Cnt_m); //임시 전체 연금 개월
	//$s2_t = ($Lev3_Cnt_y*12 +$Lev3_Cnt_m) +($Lev4_Cnt_y*12 +$Lev4_Cnt_m); //임시 전체 연금 개월
	
	//납입비율 연금 계산

	if($s1 <= 240) { 
		$s3_1 =( ($s1 - $s1%12) /12   )*3; //년도에 3%
		$s3_2 = (floor((($s1%12) * (3/12))*100)/100); //월을 나누어 3% 할당


		$s3 = $s3_1 + $s3_2; 

		//echo(floor((($s1%12) * (3/12))*100)/100);

	} else {
		//20년은 60으로 기본

		

		$s3_1 = (($s1-240)-  (($s1-240) % 12))/12 ; //20년 이상 넘는 것의 년
		$s3_2 =  $s1 - 240 -  ($s3_1 *12) ;  //20년 이상 넘는 것의 월
		$s3 = 60 + $s3_1*2 +  ((floor((($s3_2 * 2)/12) * 100))/100);


		

	}

	//echo("$s1 ($s_3_1 *12) $s3_2 $s3");

	

	

	 //납입비율 특약 계산

	 $s4_1 = ($s2 - $s2%12) /12 ;  // 특약 년
	 $s4_2 = $s2 % 12 ;  // 특약 월
	 $s4 = $s4_1*3 + (($s4_2 * 3) /12);

	 $s5 = $s3+$s4;

	 //echo($s4);
	
	 //만 나이 계산 , 무조건 1일로 가정

	 if($s_month >=$p_month) {

		$p_age = $s_year - $p_year;
	 } else {
		$p_age = $s_year - $p_year-1;

	 }

	 if($p_age <= 65) {

		 $s6 = 0.85;

	 }else if($p_age <= 66) {

		 $s6 = 0.88;

	 }else if($p_age <= 67) {

		 $s6 = 0.91;

	 }else if($p_age <= 68) {

		 $s6 = 0.94;

	 }else if($p_age <= 69) {

		 $s6 = 0.97;

	 }else  {

		 $s6 = 1;

	 }
	$temp = floatval($s5)*floatval($s6);
	$temp= floatval($temp);
	$AMT= floatval($AMT);

	$temp2= ($temp/100)*$AMT;
	//echo("  $temp $AMT $temp2     ");

	 $s_total =  floor($temp2 / 1000) * 1000 ;

	




}
?>

					<li class="w50">

							<dl>
								<dt>
									<span>납입비율</span>
								</dt>
								<dd>
									<?=$s5?>%
									 
								</dd>
							</dl>

			     	</li>

					<li class="w50">

							<dl>
								<dt>
									<span>퇴직적용율</span>
								</dt>
								<dd>
									<?=$s6*100?>%
								</dd>
							</dl>

					</li>

					<li class="w50">

							<dl>
								<dt>
									<span>퇴직나이</span>
								</dt>
								<dd>
								 <?=$p_age?>세
								</dd>
							</dl>

					</li>

					

					<li class="txtctr">* <?=$c_year?>년 현재 기준 봉급액은 <?=number_format($AMT)?> 입니다.<br>
					연금 지급금액은 연금 납입금액과 퇴직적용을 하여 매월 지급됩니다.</li>


					<li class="txtctr">
						<div class="online_bt">
							<input type="button" class="btn_ok" id="btn_submit" value="예상지급액 계산하기" onclick="checkIt(this.form)">
						</div>	
					</li>

					
</form>
					


				</ul>
			</div><!--.online_box--->

		</div><!--.online_wrap-->







		<div class="online_wrap">	

			<h2 class="online_title">예상 지급 금액</h2>
			
			<div class="online_box" style="border-top:none! important; padding-top:0px;  ">
				<ul>					

					<li class="mtit txtctr"><?=number_format( $s_total)?>원 입니다.</li>

				</ul>
			</div><!--.online_box--->

		</div><!--.online_wrap-->







</section>


<?php
include_once('tail.php'); 
?>