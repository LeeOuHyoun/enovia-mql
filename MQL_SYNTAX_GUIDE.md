# ENOVIA MQL 문법 정리 가이드

---

## 1. MQL 개요 및 기본 환경 설정

### 1.1 접속 및 세션 환경 설정
- **세션 접속**:
  ```text
  set context user <userID> password <password>;
  set context user creator;
  ```
- **실행 결과 확인 (Verbose 모드)**:
  ```text
  verb on;
  ```
- **명령어 도움말**:
  ```text
  help <command_or_admin_type>;
  help attribute;
  help bus;
  ```

### 1.2 스키마 심볼릭 네임(Symbolic Name) 등록
- 스키마 요소 정의 후 시스템 변수 매핑 테이블에 심볼릭 프로퍼티를 필수로 등록:
  ```text
  add property <admin_type>_<name> on program eServiceSchemaVariableMapping.tcl to <admin_type> <name>;
  ```

---

## 2. 데이터 스키마 모델링 (Schema Definition)

### 2.1 Attribute (속성)
- **생성 (`add attribute`)**:
  ```text
  add attribute '<attribute_name>'
      type <string|integer|real|date|boolean>
      description '<description>'
      default '<default_value>'
      notmultiline
      nothidden
      property version value 'R2019x'
      property application value 'Framework'
      property installer value 'Framework'
      property 'original name' value '<attribute_name>'
      property 'installed date' value '<date>';
  ```
- **수정 및 범위값 추가 (`mod attribute`)**:
  ```text
  mod attribute <attribute_name> add range value '<value>';
  ```
- **삭제 (`del attribute`)**:
  ```text
  del attribute '<attribute_name>';
  ```

### 2.2 Type (타입)
- **생성 (`add type`)**:
  ```text
  add type '<type_name>'
      description '<description>'
      abstract <true|false>
      derived '<parent_type_name>'
      attribute '<attribute_name1>', '<attribute_name2>';
  ```
- **속성 추가 및 수정 (`mod type`)**:
  ```text
  mod type <type_name> add attribute <attribute_name>;
  ```
- **삭제 (`del type`)**:
  ```text
  del type '<type_name>';
  ```

### 2.3 Policy (정책 및 생명주기)
- **생성 (`add policy`)**:
  ```text
  add policy '<policy_name>'
      description '<description>'
      type '<governed_type1>,<governed_type2>'
      sequence '<0,1,2,... | A,B,C,...>'
      store '<store_name>'
      format 'generic'
      state '<state_name1>'
          revision <true|false>
          version <true|false>
          promote <true|false>
          checkouthistory <true|false>
          public <all|read,modify,delete,...>
      state '<state_name2>'
          ...;
  ```
- **Access 권한 종류**:
  - `read`, `modify`, `delete`, `checkout`, `checkin`
  - `create`, `promote`, `demote`, `grant`, `enable`, `disable`
  - `fromconnect`, `toconnect`, `fromdisconnect`, `todisconnect`
  - `show`, `viewform`, `modifyform`

### 2.4 Relationship (관계)
- **생성 (`add relationship`)**:
  ```text
  add relationship '<relationship_name>'
      description '<description>'
      nothidden
      from
          type '<type_name>'
          cardinality <one|many|1|n|N>
          revision <none|float|replicate>
          clone <none|float|replicate>
      to
          type '<type_name>'
          cardinality <one|many|1|n|N>
          revision <none|float|replicate>
          clone <none|float|replicate>;
  ```
- **삭제 (`del relationship`)**:
  ```text
  del relationship '<relationship_name>';
  ```

---

## 3. 비즈니스 오브젝트 조작 (Business Object & Data Manipulation)

### 3.1 생성 (`add bus`)
```text
add bus '<type>' '<name>' '<revision>' policy '<policy>' vault '<vault>';
```

### 3.2 조회 및 검색
- **단일 오브젝트/스키마 상세 조회 (`print`)**:
  ```text
  print bus <object_id> select <selectable_items>;
  print bus '<type>' '<name>' '<revision>' select id current attribute[<attr_name>].value;
  print bus <object_id> select modified dump |;
  print bus <object_id> select name description dump output <file_path>;
  ```
- **목록 조회 (`list`)**:
  ```text
  list <admin_type> <pattern>;
  list menu Test*;
  ```
- **조건 검색 (`temp query bus`)**:
  ```text
  temp query bus '<type_pattern>' '<name_pattern>' '<rev_pattern>'
      where '<expression>'
      limit <number>
      select <selectable_items>;
  ```

### 3.3 수정 및 삭제
- **속성 및 상태 수정 (`modify bus`)**:
  ```text
  modify bus <object_id> '<attribute_name>' '<new_value>';
  ```
- **오브젝트 삭제 (`delete bus`)**:
  ```text
  delete bus <object_id>;
  delete bus <object_id> format <format_name> file <file_name>;
  ```

### 3.4 오브젝트 간 관계 연결 및 해제
- **연결 (`connect bus` / `add connection`)**:
  ```text
  connect bus '<type>' '<name>' '<rev>' relationship '<rel_name>' to '<type>' '<name>' '<rev>';
  connect bus <from_id> relationship '<rel_name>' to <to_id>;
  add connection '<rel_name>' from <from_id> to <to_id>;
  ```
- **연결 해제 (`disconnect bus`)**:
  ```text
  disconnect bus <object_id> relationship '<rel_name>' to <target_id>;
  ```

### 3.5 관계 전개 조회 (`expand bus`)
```text
expand bus <object_id>
    from relationship '<rel_pattern>' type '<type_pattern>'
    to relationship '<rel_pattern>' type '<type_pattern>'
    recurse to <depth|all>
    select bus <selectable>
    select rel <selectable>;
```

### 3.6 상태(State) 제어
- **승급 / 강등**:
  ```text
  promote bus <object_id>;
  demote bus <object_id>;
  ```
- **상태 제어 활성화 / 비활성화**:
  ```text
  enable bus <object_id> [state <state_name>];
  disable bus <object_id> [state <state_name>];
  ```
- **전자 서명(Signature)**:
  ```text
  approve bus <object_id> signature <sign_name> [comment <text>];
  reject bus <object_id> signature <sign_name> [comment <text>];
  ignore bus <object_id> signature <sign_name> [comment <text>];
  unsign bus <object_id> signature <sign_name> [comment <text>];
  override bus <object_id> [state <state_name>];
  ```

---

## 4. UI 컴포넌트 모델링 (UI Schema)

### 4.1 Command
```text
add command '<command_name>'
    description '<description>'
    label '<label_key>'
    href '<url_path>'
    setting 'Registered Suite' '<suite_name>'
    setting 'Target Location' '<content|popup|slidein>'
    setting 'Submit' 'true';
```

### 4.2 Menu & Tree Menu
- **일반 메뉴 생성**:
  ```text
  add menu '<menu_name>'
      description '<description>'
      label '<label_key>'
      setting 'Registered Suite' '<suite_name>'
      command '<command_name1>'
      command '<command_name2>';
  ```
- **타입별 Tree Menu 등록**:
  ```text
  add menu 'type_<type_name>'
      description ''
      label '${NAME}'
      href '${COMMON_DIR}/emxForm.jsp?form=<form_name>&toolbar=<menu_name>'
      setting 'Image' '${COMMON_DIR}/<icon_file>'
      setting 'Registered Suite' '<suite_name>'
      command '<command_name>';
  
  mod menu Tree add menu 'type_<type_name>';
  ```

### 4.3 Webform
```text
add form '<form_name>' web
    field
        name '<field_name>'
        label '<label_key>'
        businessobject '<name | $<description> | $<attribute[<attr_name>].value>>'
        setting 'Registered Suite' '<suite_name>'
        setting 'Field Type' 'basic|attribute'
        setting 'Editable' 'true|false'
        setting 'Input Type' 'textarea|textbox'
        setting 'Required' 'true|false';
```

### 4.4 Table
```text
add table '<table_name>' system
    column
        name '<col_name>'
        label '<label_key>'
        businessobject '$<attribute[<attr_name>].value>'
        sorttype 'none|alphanumeric|other'
        setting 'Registered Suite' '<suite_name>'
        setting 'Field Type' 'attribute'
        setting 'Admin Type' '<attr_symbolic_name>'
    column
        name '<col_name2>'
        label '<label_key>'
        businessobject 'name'
        href '${COMMON_DIR}/emxTree.jsp'
        setting 'Target Location' 'content';
```

### 4.5 Channel & Portal
- **Channel**:
  ```text
  add channel '<channel_name>'
      description '<description>'
      height '<height_percentage>'
      setting 'Registered Suite' '<suite_name>'
      command '<command_name1>'
      command '<command_name2>';
  ```
- **Portal**:
  ```text
  add portal '<portal_name>'
      description '<description>'
      setting 'Registered Suite' '<suite_name>'
      channel '<channel_name1>'
      channel '<channel_name2>';
  ```

---

## 5. 시스템 자동화 및 트리거 연동

### 5.1 Object Generator & Number Generator
- **Object Generator 등록**:
  ```text
  add bus 'eService Object Generator' '<name>' '<rev>'
      policy 'eService Object Generator'
      vault 'eService Administration'
      state 'Exists'
      'eService Safety Policy' '<target_policy>'
      'eService Safety Vault' 'vault_eServiceAdministration'
      'eService Name Prefix' '<prefix>';
  ```
- **Number Generator 등록 및 연계**:
  ```text
  add bus 'eService Number Generator' '<name>' '<rev>'
      policy 'eService Object Generator'
      vault 'eService Administration'
      state 'Exists'
      sequence '1'
      'eService Next Number' '001';
  
  add connection 'eService Number Generator'
      from 'eService Object Generator' '<name>' '<rev>'
      to 'eService Number Generator' '<name>' '<rev>';
  ```

### 5.2 Trigger (트리거 매니저) 및 JPO 연동
- **JPO 등록/컴파일**:
  ```text
  insert program '<local_filepath>/<class>_mxJPO.java';
  compile program <class> [force update];
  ```
- **Trigger 파라미터 등록**:
  ```text
  add bus 'eService Trigger Program Parameters' '<trigger_name>' '<method_name>'
      vault 'eService Administration'
      policy 'eService Trigger Program Policy'
      current 'Active'
      'eService Sequence Number' '1'
      'eService Program Argument 1' '${OBJECTID}'
      'eService Method Name' '<method_name>'
      'eService Program Name' '<jpo_name>'
      'eService Error Type' 'Error';
  ```
- **Policy / Type 에 트리거 매핑**:
  ```text
  mod policy '<policy_name>' state '<state_name>'
      add trigger '<action|check>' '<promote|demote>' emxTriggerManager input '<trigger_name>';
  ```

---

## 6. MQL 작업 가이드 및 주의사항

1. **실행 순서 의존성**:
   - Attribute 생성 → Type 생성 (속성 포함) → Policy 생성 (타입 연결) → Relationship 생성 → UI 컴포넌트(Command, Menu, Form, Table 등) 생성
2. **Channel 및 복합 컴포넌트 수정 원칙**:
   - Channel의 경우 생성 후 Command 추가가 지원되지 않으므로, 수정 필요 시 기존 Channel을 `del` 후 `add`로 재생성
   - Table, Webform 또한 변경 필드가 많은 경우 `del` 후 재생성을 권장
3. **운영 환경 데이터 보존**:
   - 운영/배포 환경에서는 `del`을 지양하고 하위 호환성을 위해 `mod` 구문으로 변경 이력을 관리
